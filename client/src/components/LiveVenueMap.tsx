import { useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type MapZone = { id: string; name: string; score: number; status: string; x: number; y: number; w: number; h: number };

const CENTER: [number, number] = [13.08272, 80.27072];
const BOUNDS: [[number, number], [number, number]] = [[13.0788, 80.2658], [13.0864, 80.2758]];
const volunteers = [{ id: "V07", pos: [13.0838, 80.2687] as [number, number] }, { id: "V03", pos: [13.0845, 80.2718] as [number, number] }, { id: "V11", pos: [13.0843, 80.2741] as [number, number] }, { id: "V09", pos: [13.0812, 80.2709] as [number, number] }];

function zoneBounds(zone: MapZone): [[number, number], [number, number]] {
  const north = BOUNDS[1][0] - (zone.y / 100) * (BOUNDS[1][0] - BOUNDS[0][0]);
  const west = BOUNDS[0][1] + (zone.x / 100) * (BOUNDS[1][1] - BOUNDS[0][1]);
  const south = north - Math.max(.00055, (zone.h / 100) * (BOUNDS[1][0] - BOUNDS[0][0]));
  const east = west + Math.max(.00075, (zone.w / 100) * (BOUNDS[1][1] - BOUNDS[0][1]));
  return [[south, west], [north, east]];
}

function FlyToZone({ zone }: { zone?: MapZone }) {
  const map = useMap();
  if (zone) map.setView([zoneBounds(zone)[0][0] + .0004, zoneBounds(zone)[0][1] + .0004], 17, { animate: true });
  return null;
}

export default function LiveVenueMap({ zones, selectedId, onSelect }: { zones: MapZone[]; selectedId: string; onSelect: (zone: MapZone) => void }) {
  const selected = zones.find((zone) => zone.id === selectedId);
  const icon = useMemo(() => L.divIcon({ className: "leaflet-volunteer-icon", html: '<span>V</span>', iconSize: [20, 20], iconAnchor: [10, 10] }), []);
  return <div className="live-leaflet-map"><MapContainer center={CENTER} zoom={16} minZoom={15} maxZoom={19} scrollWheelZoom={false} zoomControl={false} maxBounds={BOUNDS} maxBoundsViscosity={.8}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><FlyToZone zone={selected} />{zones.map((zone) => { const bounds = zoneBounds(zone); const color = zone.status === "covered" ? "#69d8b2" : zone.score >= 65 ? "#ff806a" : zone.score >= 40 ? "#ffd166" : "#7acbff"; return <Polygon key={zone.id} positions={bounds} pathOptions={{ color, fillColor: color, fillOpacity: zone.id === selectedId ? .52 : .28, weight: zone.id === selectedId ? 3 : 1.5 }} eventHandlers={{ click: () => onSelect(zone) }}><Popup><strong>Zone {zone.id} · {zone.name}</strong><br />AI search priority: {zone.score}%<br />Status: {zone.status}</Popup></Polygon>; })}<CircleMarker center={[13.0831, 80.2702]} radius={8} pathOptions={{ color: "#291516", fillColor: "#ff806a", fillOpacity: 1, weight: 3 }}><Popup><strong>Last seen</strong><br />Food Court · 13:15</Popup></CircleMarker>{volunteers.map((volunteer) => <Marker key={volunteer.id} position={volunteer.pos} icon={icon}><Popup>Volunteer {volunteer.id}<br />Live GPS location</Popup></Marker>)}</MapContainer><div className="leaflet-map-label"><span className="pulse-dot" /> LIVE GPS · OSM VENUE BASEMAP</div></div>;
}
