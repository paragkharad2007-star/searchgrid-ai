import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Position = { lat: number; lng: number; accuracy?: number };
const DESTINATION: [number, number] = [13.0831, 80.2702];
const DEFAULT_ORIGIN: [number, number] = [13.0827, 80.2707];

function FollowPosition({ position }: { position: Position }) {
  const map = useMap();
  useEffect(() => { map.setView([position.lat, position.lng], Math.max(map.getZoom(), 17), { animate: true }); }, [map, position.lat, position.lng]);
  return null;
}

export default function VolunteerLiveMap({ position }: { position?: Position }) {
  const origin: [number, number] = position ? [position.lat, position.lng] : DEFAULT_ORIGIN;
  return <div className="volunteer-live-map"><MapContainer center={origin} zoom={17} scrollWheelZoom={false} zoomControl={false} attributionControl={true}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{position && <FollowPosition position={position} />}<Polyline positions={[origin, DESTINATION]} pathOptions={{ color: "#ff806a", weight: 5, opacity: .9, dashArray: "9 8" }} /><CircleMarker center={origin} radius={9} pathOptions={{ color: "#082119", fillColor: "#9ff7d2", fillOpacity: 1, weight: 3 }}><Popup><strong>YOU · V07</strong><br />Live GPS position</Popup></CircleMarker>{position?.accuracy && <Circle center={origin} radius={position.accuracy} pathOptions={{ color: "#9ff7d2", fillColor: "#9ff7d2", fillOpacity: .12, weight: 1 }} />}<CircleMarker center={DESTINATION} radius={9} pathOptions={{ color: "#291516", fillColor: "#ff806a", fillOpacity: 1, weight: 3 }}><Popup><strong>Zone B · Food Court</strong><br />Assigned destination</Popup></CircleMarker></MapContainer><div className="volunteer-map-status"><span className="pulse-dot" /> {position ? "LIVE GPS · POSITION SHARED" : "LIVE MAP · GPS WAITING"}</div><div className="volunteer-map-legend"><span><i className="legend-dot you" /> You</span><span><i className="legend-dot destination" /> Zone B</span></div></div>;
}
