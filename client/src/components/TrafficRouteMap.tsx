import { useState } from "react";
import { MapView } from "@/components/Map";

type TrafficRouteMapProps = { origin?: { lat: number; lng: number }; destination?: { lat: number; lng: number } };

export default function TrafficRouteMap({ origin = { lat: 13.0827, lng: 80.2707 }, destination = { lat: 13.0831, lng: 80.2702 } }: TrafficRouteMapProps) {
  const [eta, setEta] = useState("Calculating live ETA…");
  const [traffic, setTraffic] = useState("Checking traffic");
  return <div className="traffic-route-map"><MapView initialCenter={origin} initialZoom={17} onMapReady={(map) => {
    const directionsService = new google.maps.DirectionsService();
    const renderer = new google.maps.DirectionsRenderer({ map, suppressMarkers: false, preserveViewport: false });
    new google.maps.TrafficLayer().setMap(map);
    directionsService.route({ origin, destination, travelMode: google.maps.TravelMode.WALKING, drivingOptions: { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS } }, (response, status) => {
      if (status !== "OK" || !response) { setEta("Route unavailable"); setTraffic("Try again near the venue"); return; }
      renderer.setDirections(response);
      const leg = response.routes[0]?.legs[0];
      setEta(leg?.duration?.text ?? "2 min");
      setTraffic("Live map traffic layer enabled");
    });
  }} /><div className="traffic-route-overlay"><span className="status-dot" /> <strong>{eta}</strong><small>{traffic}</small></div></div>;
}
