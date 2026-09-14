import { EventEmitter } from "node:events";

export type IncidentEvent = {
  type: "sighting_reported" | "zone_completed" | "ai_recalculated" | "assignment_changed";
  incidentCode: string;
  payload: Record<string, unknown>;
  emittedAt: number;
};

export const incidentEvents = new EventEmitter();

export function emitIncidentEvent(event: Omit<IncidentEvent, "emittedAt">) {
  incidentEvents.emit("incident", { ...event, emittedAt: Date.now() } satisfies IncidentEvent);
}
