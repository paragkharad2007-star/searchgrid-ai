import { describe, expect, it } from "vitest";
import { calculateSearchPriority, priorityForScore } from "../shared/searchgrid";

describe("SEARCHGRID priority model", () => {
  it("boosts a nearby last-seen zone with sighting evidence", () => {
    const foodCourt = calculateSearchPriority({ id: "B", x: 31, baseScore: 86, priority: "HIGH", status: "searching" }, 12, 2);
    const parking = calculateSearchPriority({ id: "I", x: 8, baseScore: 30, priority: "LOW", status: "queued" }, 12, 2);

    expect(foodCourt).toBeGreaterThan(parking);
    expect(foodCourt).toBeGreaterThanOrEqual(65);
  });

  it("penalizes an area after it has been searched", () => {
    const open = calculateSearchPriority({ id: "F", x: 31, baseScore: 49, priority: "MEDIUM", status: "queued" }, 12, 2);
    const covered = calculateSearchPriority({ id: "F", x: 31, baseScore: 49, priority: "MEDIUM", status: "covered" }, 12, 2);

    expect(covered).toBeLessThan(open);
  });

  it("maps scores to explainable priority bands", () => {
    expect(priorityForScore(82)).toBe("HIGH");
    expect(priorityForScore(57)).toBe("MEDIUM");
    expect(priorityForScore(18)).toBe("LOW");
  });
});
