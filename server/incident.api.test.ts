import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { incidentEvents } from "./incidentEvents";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "admin" | "user" | null): TrpcContext {
  return {
    user: role ? { id: 7, openId: `test-${role}`, email: "test@example.com", name: "Test User", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("incident coordination API", () => {
  it("exposes a demo incident to public command-center previews", async () => {
    const result = await appRouter.createCaller(contextFor(null)).incident.current();
    expect(result.incident.code).toBe("CX1008");
    expect(result.incident.status).toBe("active");
  });

  it("allows an authenticated volunteer to mark a zone searched and emits an update", async () => {
    const received: unknown[] = [];
    const listener = (event: unknown) => received.push(event);
    incidentEvents.on("incident", listener);
    const result = await appRouter.createCaller(contextFor("user")).incident.markZoneSearched({ zone: "B" });
    incidentEvents.off("incident", listener);
    expect(result).toEqual({ success: true, zone: "B" });
    expect(received).toHaveLength(2);
  });

  it("requires a coordinator role to seed persistent incident data", async () => {
    await expect(appRouter.createCaller(contextFor("user")).incident.seed()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires coordinator access for user administration", async () => {
    await expect(appRouter.createCaller(contextFor("user")).admin.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts authenticated volunteer GPS updates and broadcasts them", async () => {
    const received: unknown[] = [];
    const listener = (event: unknown) => received.push(event);
    incidentEvents.on("incident", listener);
    const location = await appRouter.createCaller(contextFor("user")).volunteer.updateLocation({ lat: 13.0827, lng: 80.2707, accuracy: 12 });
    incidentEvents.off("incident", listener);
    expect(location.lat).toBe(13.0827);
    expect(received).toHaveLength(1);
  });
});
