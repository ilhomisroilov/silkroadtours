"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from "react-leaflet";

function Clicks({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Math.round(e.latlng.lat * 1e4) / 1e4, Math.round(e.latlng.lng * 1e4) / 1e4) });
  return null;
}

const dot = (n: number) =>
  L.divIcon({ className: "", iconSize: [28, 28], iconAnchor: [14, 14], html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#1f3a93;color:#fff;font:700 12px system-ui;border:2px solid #d4a24c">${n}</span>` });

/** Admin route editor: click the map to add a stop. */
export default function PointPicker({ points, onPick }: { points: { lat: number; lng: number; label: string }[]; onPick: (lat: number, lng: number) => void }) {
  const center: [number, number] = points[0] ? [points[0].lat, points[0].lng] : [40.1, 66.5];
  return (
    <MapContainer center={center} zoom={6} className="h-full w-full" scrollWheelZoom>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      {points.length > 1 && <Polyline positions={points.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#b5532e", weight: 3 }} />}
      {points.map((p, i) => (
        <Marker key={`${p.lat}-${p.lng}-${i}`} position={[p.lat, p.lng]} icon={dot(i + 1)} title={p.label} />
      ))}
      <Clicks onPick={onPick} />
    </MapContainer>
  );
}
