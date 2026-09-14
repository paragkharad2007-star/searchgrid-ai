export type SearchPriority = "HIGH" | "MEDIUM" | "LOW";

export type SearchZoneSignal = {
  id: string;
  x: number;
  baseScore: number;
  priority: SearchPriority;
  status: "searching" | "queued" | "covered" | "alert";
};

/**
 * Lightweight, explainable priority model for demo operations.
 * It ranks search areas; it does not claim to locate a person.
 */
export function calculateSearchPriority(zone: SearchZoneSignal, sightingBoost: number, elapsedMinutes: number) {
  const distanceFactor = Math.max(0, 22 - Math.round(zone.x / 5));
  const timeFactor = Math.min(14, Math.round(elapsedMinutes * 1.4));
  const flowFactor = zone.id === "B" || zone.id === "C" ? 16 : zone.priority === "MEDIUM" ? 10 : 5;
  const sightingFactor = zone.id === "B" ? sightingBoost : zone.id === "C" ? Math.round(sightingBoost * 0.45) : 0;
  const pathwayFactor = ["B", "C", "E", "F"].includes(zone.id) ? 13 : 7;
  const venueFeatureFactor = ["B", "D", "A"].includes(zone.id) ? 12 : 4;
  const searchedPenalty = zone.status === "covered" ? 28 : zone.status === "alert" ? -4 : 0;
  return Math.max(8, Math.min(99, Math.round(distanceFactor + timeFactor + flowFactor + sightingFactor + pathwayFactor + venueFeatureFactor - searchedPenalty)));
}

export function priorityForScore(score: number): SearchPriority {
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}
