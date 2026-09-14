import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { emitIncidentEvent } from "./incidentEvents";
import { createIncident, ensureIncident, getDb, getIncidentByCode, insertSighting, listSightings, listUsers, resolveIncident, updateUserRole } from "./db";
import { incidents } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const DEMO_INCIDENT = { id: 1, code: "CX1008", title: "Missing person — Arjun R.", venue: "City Festival Ground", status: "active" as "active" | "resolved", lastSeenZone: "Food Court", lastSeenAt: new Date("2026-09-14T07:45:00Z") };
let demoSightings = [{ id: 1, incidentId: 1, zone: "Food Court · north aisle", label: "Possible sighting", source: "Volunteer V07", confidence: 82, createdAt: new Date("2026-09-14T07:46:00Z") }];
let demoIncident = DEMO_INCIDENT;
let demoUsers = [{ id: 1, openId: "demo-coordinator", name: "Operations Coordinator", email: "ops@searchgrid.demo", role: "admin" as const, lastSignedIn: new Date() }, { id: 2, openId: "demo-volunteer", name: "Field Volunteer V07", email: "v07@searchgrid.demo", role: "user" as const, lastSignedIn: new Date() }];
const liveLocations = new Map<string, { lat: number; lng: number; accuracy: number; at: number }>();

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
    list: coordinatorOnly.query(async () => {
      const db = await getDb();
      if (!db) return [demoIncident];
      return db.select().from(incidents).orderBy(incidents.updatedAt).limit(50);
    }),
    create: coordinatorOnly.input(z.object({ code: z.string().min(3).max(32), title: z.string().min(3), venue: z.string().min(2), lastSeenZone: z.string().min(2) })).mutation(async ({ input }) => {
      const created = await createIncident({ ...input, lastSeenAt: new Date() });
      const incident = created ?? { id: Date.now(), ...input, status: "active" as const, lastSeenAt: new Date() };
      demoIncident = incident;
      emitIncidentEvent({ type: "incident_created", incidentCode: incident.code, payload: incident });
      return incident;
    }),
    resolve: coordinatorOnly.input(z.object({ code: z.string().min(3) })).mutation(async ({ input }) => {
      const resolved = await resolveIncident(input.code);
      demoIncident = { ...demoIncident, status: "resolved" };
      emitIncidentEvent({ type: "incident_resolved", incidentCode: input.code, payload: { code: input.code } });
      return resolved ?? demoIncident;
    }),
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
  admin: router({
    users: coordinatorOnly.query(async () => {
      const rows = await listUsers();
      return rows.length ? rows : demoUsers;
    }),
    setRole: coordinatorOnly.input(z.object({ id: z.number().int(), role: z.enum(["admin", "user"]) })).mutation(async ({ input }) => {
      const updated = await updateUserRole(input.id, input.role);
      demoUsers = demoUsers.map((user) => user.id === input.id ? { ...user, role: input.role } : user);
      return updated ?? demoUsers.find((user) => user.id === input.id) ?? { id: input.id, role: input.role };
    }),
  }),
  volunteer: router({
    updateLocation: protectedProcedure.input(z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().min(0).max(10000) })).mutation(({ ctx, input }) => {
      const volunteerId = ctx.user.openId;
      const location = { ...input, at: Date.now() };
      liveLocations.set(volunteerId, location);
      emitIncidentEvent({ type: "volunteer_location_updated", incidentCode: "CX1008", payload: { volunteerId, ...location } });
      return location;
    }),
  }),
});

export type AppRouter = typeof appRouter;
