"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapPoint } from "./lazy-map";

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0]!.lat, points[0]!.lng], 9);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [36, 36] });
  }, [map, points]);
  return null;
}

/** Brand-styled marker (no image assets): a lapis eight-point star with an optional day number. */
function icon(p: MapPoint) {
  const label = p.number != null ? String(p.number) : "";
  return L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;color:#fff;font:700 13px/1 system-ui,sans-serif;background:#1f3a93;border:2px solid #d4a24c;border-radius:9px;transform:rotate(45deg);box-shadow:0 4px 10px rgba(14,26,69,.35)"><span style="transform:rotate(-45deg)">${label}</span></span>`,
  });
}

export default function LeafletMap({ points, route, attribution }: { points: MapPoint[]; route?: boolean; attribution: string }) {
  const center: [number, number] = points[0] ? [points[0].lat, points[0].lng] : [41.3, 64.6];
  return (
    <MapContainer center={center} zoom={6} scrollWheelZoom={false} className="h-full w-full" attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">${attribution}</a>`} maxZoom={18} />
      {route && points.length > 1 && (
        <Polyline positions={points.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#b5532e", weight: 3, dashArray: "6 8" }} />
      )}
      {points.map((p, i) => (
        <Marker key={`${p.lat}-${p.lng}-${i}`} position={[p.lat, p.lng]} icon={icon(p)} title={p.label} alt={p.label}>
          <Popup>
            {p.href ? (
              <a href={p.href} style={{ fontWeight: 700, color: "#1f3a93" }}>
                {p.label}
              </a>
            ) : (
              <strong>{p.label}</strong>
            )}
            {p.caption && <div style={{ marginTop: 4 }}>{p.caption}</div>}
          </Popup>
        </Marker>
      ))}
      <FitBounds points={points} />
    </MapContainer>
  );
}
