import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notifyOwner: vi.fn(async () => true),
  storagePut: vi.fn(async () => ({ key: "searchgrid-backups/CX1008.json", url: "/manus-storage/searchgrid-backups/CX1008.json" })),
  getIncidentByCode: vi.fn(async () => ({ id: 1, code: "CX1008", title: "Missing person", venue: "City Festival Ground" })),
  listSightings: vi.fn(async () => [{ id: 7, label: "Possible sighting", zone: "Zone B" }]),
  listAuditLogs: vi.fn(async () => [{ id: 9, action: "SIGHTING_REPORTED", detail: "Zone B" }]),
}));

vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("./db", () => ({ getIncidentByCode: mocks.getIncidentByCode, listSightings: mocks.listSightings, listAuditLogs: mocks.listAuditLogs }));

import { createIncidentBackup, dispatchUrgentEscalation } from "./opsServices";

describe("operations services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.URGENT_EMAIL_WEBHOOK_URL;
    delete process.env.URGENT_SMS_WEBHOOK_URL;
  });

  it("dispatches an owner alert and reports configured escalation channels", async () => {
    const result = await dispatchUrgentEscalation({ incidentCode: "CX1008", title: "Possible sighting", detail: "Zone B · confidence 92%" });
    expect(mocks.notifyOwner).toHaveBeenCalledOnce();
    expect(result).toEqual({ ownerNotified: true, configuredChannels: 0, deliveredChannels: 0 });
  });

  it("uploads a complete incident snapshot to durable storage", async () => {
    const result = await createIncidentBackup("CX1008");
    expect(mocks.storagePut).toHaveBeenCalledOnce();
    expect(mocks.storagePut.mock.calls[0]?.[0]).toBe("searchgrid-backups/CX1008.json");
    expect(String(mocks.storagePut.mock.calls[0]?.[1])).toContain("Possible sighting");
    expect(result.url).toContain("/manus-storage/");
  });
});
