"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, type ReactNode } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { TripItemKind } from "@/lib/trip-store";

export type MarkerGlyph = TripItemKind | "user" | "point";

export interface AtlasMarker {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
  /** Short text inside the pin (a day number); otherwise the glyph for the kind is drawn. */
  badge?: string;
  glyph?: MarkerGlyph;
  popup?: ReactNode;
  /** Ring the pin (e.g. "already in my trip"). */
  highlight?: boolean;
}

export interface AtlasRoute {
  id: string;
  positions: [number, number][];
  color: string;
  dashed?: boolean;
}

export interface AtlasMapProps {
  markers: AtlasMarker[];
  routes?: AtlasRoute[];
  focusId?: string | null;
  user?: { lat: number; lng: number } | null;
  userLabel?: string;
  onMapClick?: (pos: { lat: number; lng: number }) => void;
  /** Change this value to re-fit the view to all markers (or to `fitTo` when given). */
  fitKey?: string;
  fitTo?: { lat: number; lng: number }[];
  attribution: string;
  scrollWheelZoom?: boolean;
}

// Simplified 24×24 line glyphs (drawn in white inside the pin).
const GLYPHS: Record<MarkerGlyph, string> = {
  hotel: "M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 14h18M7 10V8.5A1.5 1.5 0 0 1 8.5 7h3A1.5 1.5 0 0 1 13 8.5V10",
  restaurant: "M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.7 1-3 3-3 6v3h3v9",
  attraction: "M4 21h16M6 21v-7M18 21v-7M12 4a6 6 0 0 1 6 6H6a6 6 0 0 1 6-6zM12 2v2",
  experience: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5l-5.3 2.9 1.2-6-4.5-4.1 6-.7z",
  activity: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5l-5.3 2.9 1.2-6-4.5-4.1 6-.7z",
  tour: "M5 21V4M5 4h11l-2 4 2 4H5",
  train: "M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM5 10h14M9 21l1.5-4M15 21l-1.5-4",
  flight: "M3 13l18-8-6 16-3-6.5L3 13z",
  transport: "M4 16h16M5.5 16l1.6-5h9.8l1.6 5M6 16v3M18 16v3M8 11l1-3h6l1 3",
  transfer: "M4 16h16M5.5 16l1.6-5h9.8l1.6 5M6 16v3M18 16v3M8 11l1-3h6l1 3",
  user: "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  point: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const iconCache = new Map<string, L.DivIcon>();
/** Icons are cached by look, so re-renders (e.g. after "Add to trip" in a popup) do not rebuild marker elements. */
function pinIcon(m: AtlasMarker): L.DivIcon {
  const key = `${m.color}|${m.badge ?? ""}|${m.glyph ?? ""}|${m.highlight ? 1 : 0}`;
  let icon = iconCache.get(key);
  if (!icon) iconCache.set(key, (icon = buildPin(m)));
  return icon;
}

function buildPin(m: AtlasMarker): L.DivIcon {
  const ring = m.highlight ? "box-shadow:0 0 0 3px #d9a441,0 6px 14px rgba(11,31,54,.35)" : "box-shadow:0 6px 14px rgba(11,31,54,.35)";
  const inner = m.badge
    ? `<span style="font:800 13px/1 Manrope,system-ui,sans-serif;color:#fff">${esc(m.badge)}</span>`
    : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${GLYPHS[m.glyph ?? "point"]}"/></svg>`;
  return L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:${m.color};border:2px solid #fff;${ring}">${inner}</span>`,
  });
}

const userIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<span style="display:block;width:22px;height:22px;border-radius:999px;background:#245ba8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(36,91,168,.25)"></span>`,
});

function Fit({ markers, user, fitKey, fitTo }: { markers: AtlasMarker[]; user?: { lat: number; lng: number } | null; fitKey?: string; fitTo?: { lat: number; lng: number }[] }) {
  const map = useMap();
  const latest = useRef({ markers, user, fitTo });
  latest.current = { markers, user, fitTo };
  useEffect(() => {
    const { markers: ms, user: u, fitTo: only } = latest.current;
    const pts: [number, number][] = (only?.length ? only : ms).map((m) => [m.lat, m.lng]);
    if (u) pts.push([u.lat, u.lng]);
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(pts[0]!, 13);
    else map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
  }, [map, fitKey]);
  return null;
}

function Focus({ focusId, refs, markers }: { focusId?: string | null; refs: React.RefObject<Map<string, L.Marker>>; markers: AtlasMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!focusId) return;
    const m = markers.find((x) => x.id === focusId);
    if (!m) return;
    map.setView([m.lat, m.lng], Math.max(map.getZoom(), 14));
    const t = setTimeout(() => refs.current?.get(focusId)?.openPopup(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, map, markers.length]);
  return null;
}

function Clicks({ onMapClick }: { onMapClick?: (pos: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Leaflet + OpenStreetMap map with brand pins, coloured routes and React popups (for the Trip Constructor and the navigator). */
export default function AtlasMap({ markers, routes = [], focusId, user, userLabel, onMapClick, fitKey, fitTo, attribution, scrollWheelZoom = true }: AtlasMapProps) {
  const refs = useRef(new Map<string, L.Marker>());
  const center: [number, number] = markers[0] ? [markers[0].lat, markers[0].lng] : [41.3, 64.6];
  return (
    <MapContainer center={center} zoom={6} scrollWheelZoom={scrollWheelZoom} className="h-full w-full" attributionControl>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">${esc(attribution)}</a>`}
        maxZoom={19}
      />
      {routes.map((r) =>
        r.positions.length > 1 ? (
          <Polyline key={r.id} positions={r.positions} pathOptions={{ color: r.color, weight: 4, opacity: 0.85, dashArray: r.dashed ? "6 9" : undefined }} />
        ) : null,
      )}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(m)}
          title={m.label}
          alt={m.label}
          keyboard
          ref={(el) => {
            if (el) refs.current.set(m.id, el);
            else refs.current.delete(m.id);
          }}
        >
          {m.popup && <Popup minWidth={220} maxWidth={280}>{m.popup}</Popup>}
        </Marker>
      ))}
      {user && <Marker position={[user.lat, user.lng]} icon={userIcon} title={userLabel} alt={userLabel} zIndexOffset={1000} />}
      <Fit markers={markers} user={user} fitKey={fitKey} fitTo={fitTo} />
      <Focus focusId={focusId} refs={refs} markers={markers} />
      <Clicks onMapClick={onMapClick} />
    </MapContainer>
  );
}
