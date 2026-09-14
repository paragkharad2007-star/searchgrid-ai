import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";

export type IncidentRealtimeEvent = { type: string; incidentCode: string; payload: Record<string, unknown>; emittedAt: number };

export function useIncidentRealtime(incidentCode: string, onEvent: (event: IncidentRealtimeEvent) => void) {
  useEffect(() => {
    const socket: Socket = io({ transports: ["websocket", "polling"], withCredentials: true });
    socket.on("connect", () => socket.emit("join_incident", incidentCode));
    const types = ["sighting_reported", "zone_completed", "ai_recalculated", "assignment_changed", "incident_created", "incident_resolved", "volunteer_location_updated", "connectivity_changed"];
    types.forEach((type) => socket.on(type, (event) => onEvent({ type, ...(event ?? {}) })));
    return () => { socket.disconnect(); };
  }, [incidentCode, onEvent]);
}
