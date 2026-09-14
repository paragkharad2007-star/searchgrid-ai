import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { emitIncidentEvent } from "./incidentEvents";
import { ensureIncident, getDb, getIncidentByCode, insertSighting, listSightings } from "./db";
import { incidents } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const DEMO_INCIDENT = { id: 1, code: "CX1008", title: "Missing person — Arjun R.", venue: "City Festival Ground", status: "active" as const, lastSeenZone: "Food Court", lastSeenAt: new Date("2026-09-14T07:45:00Z") };
let demoSightings = [{ id: 1, incidentId: 1, zone: "Food Court · north aisle", label: "Possible sighting", source: "Volunteer V07", confidence: 82, createdAt: new Date("2026-09-14T07:46:00Z") }];

const coordinatorOnly = adminProcedure;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  incident: router({
    current: publicProcedure.query(async () => {
      const incident = await ensureIncident({ code: DEMO_INCIDENT.code, title: DEMO_INCIDENT.title, venue: DEMO_INCIDENT.venue, lastSeenZone: DEMO_INCIDENT.lastSeenZone, lastSeenAt: DEMO_INCIDENT.lastSeenAt });
      const rows = incident ? await listSightings(incident.id) : demoSightings;
      return { incident: incident ?? DEMO_INCIDENT, sightings: rows.length ? rows : demoSightings };
    }),
    reportSighting: protectedProcedure.input(z.object({ zone: z.string().min(1), label: z.string().min(1), source: z.string().min(1), confidence: z.number().int().min(0).max(100) })).mutation(async ({ ctx, input }) => {
      const incident = await ensureIncident({ code: DEMO_INCIDENT.code, title: DEMO_INCIDENT.title, venue: DEMO_INCIDENT.venue, lastSeenZone: DEMO_INCIDENT.lastSeenZone, lastSeenAt: DEMO_INCIDENT.lastSeenAt });
      const saved = incident ? await insertSighting({ incidentId: incident.id, ...input, reportedBy: ctx.user.openId }) : undefined;
      const sighting = saved ?? { id: Date.now(), incidentId: 1, ...input, reportedBy: ctx.user.openId, createdAt: new Date() };
      if (!saved) demoSightings = [sighting, ...demoSightings].slice(0, 20);
      emitIncidentEvent({ type: "sighting_reported", incidentCode: "CX1008", payload: sighting });
      emitIncidentEvent({ type: "ai_recalculated", incidentCode: "CX1008", payload: { reason: "new sighting", zone: input.zone } });
      return sighting;
    }),
    markZoneSearched: protectedProcedure.input(z.object({ zone: z.string().min(1) })).mutation(({ input }) => {
      emitIncidentEvent({ type: "zone_completed", incidentCode: "CX1008", payload: { zone: input.zone } });
      emitIncidentEvent({ type: "assignment_changed", incidentCode: "CX1008", payload: { zone: input.zone, reason: "zone completed" } });
      return { success: true, zone: input.zone };
    }),
    seed: coordinatorOnly.mutation(async () => {
      const db = await getDb();
      if (!db) return DEMO_INCIDENT;
      const existing = await getIncidentByCode("CX1008");
      if (existing) return existing;
      const result = await db.insert(incidents).values({ code: "CX1008", title: DEMO_INCIDENT.title, venue: DEMO_INCIDENT.venue, lastSeenZone: DEMO_INCIDENT.lastSeenZone, lastSeenAt: DEMO_INCIDENT.lastSeenAt });
      return { ...DEMO_INCIDENT, id: Number(result[0].insertId) };
    }),
  }),
});

export type AppRouter = typeof appRouter;
