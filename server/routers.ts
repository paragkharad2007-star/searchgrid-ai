import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { emitIncidentEvent } from "./incidentEvents";
import { createIncident, ensureIncident, getDb, getIncidentByCode, insertSighting, listAuditLogs, listSightings, listUsers, resolveIncident, updateUserRole, writeAuditLog } from "./db";
import { incidents } from "../drizzle/schema";

const DEMO_INCIDENT = { id: 1, code: "CX1008", title: "Missing person — Arjun R.", venue: "City Festival Ground", status: "active" as "active" | "resolved", lastSeenZone: "Food Court", lastSeenAt: new Date("2026-09-14T07:45:00Z") };
let demoIncident = DEMO_INCIDENT;
let demoSightings = [{ id: 1, incidentId: 1, zone: "Food Court · north aisle", label: "Possible sighting", source: "Volunteer V07", confidence: 82, createdAt: new Date("2026-09-14T07:46:00Z") }];
let demoUsers = [{ id: 1, openId: "demo-coordinator", name: "Operations Coordinator", email: "ops@searchgrid.demo", role: "admin" as const, lastSignedIn: new Date() }, { id: 2, openId: "demo-volunteer", name: "Field Volunteer V07", email: "v07@searchgrid.demo", role: "user" as const, lastSignedIn: new Date() }];
let demoAuditLogs = [{ id: 1, incidentCode: "CX1008", actor: "Operations Coordinator", action: "INCIDENT_STARTED", detail: "Search grid activated at City Festival Ground", createdAt: new Date("2026-09-14T07:45:00Z") }];
const liveLocations = new Map<string, { lat: number; lng: number; accuracy: number; at: number }>();
const coordinatorOnly = adminProcedure;

function addDemoAudit(incidentCode: string, actor: string, action: string, detail: string) {
  demoAuditLogs = [{ id: Date.now(), incidentCode, actor, action, detail, createdAt: new Date() }, ...demoAuditLogs].slice(0, 100);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  incident: router({
    list: coordinatorOnly.query(async () => { const db = await getDb(); if (!db) return [demoIncident]; return db.select().from(incidents).orderBy(incidents.updatedAt).limit(50); }),
    current: publicProcedure.query(async () => { const incident = await ensureIncident({ code: DEMO_INCIDENT.code, title: DEMO_INCIDENT.title, venue: DEMO_INCIDENT.venue, lastSeenZone: DEMO_INCIDENT.lastSeenZone, lastSeenAt: DEMO_INCIDENT.lastSeenAt }); const rows = incident ? await listSightings(incident.id) : demoSightings; return { incident: incident ?? demoIncident, sightings: rows.length ? rows : demoSightings }; }),
    create: coordinatorOnly.input(z.object({ code: z.string().min(3).max(32), title: z.string().min(3), venue: z.string().min(2), lastSeenZone: z.string().min(2) })).mutation(async ({ ctx, input }) => { const created = await createIncident({ ...input, lastSeenAt: new Date() }); const incident = created ?? { id: Date.now(), ...input, status: "active" as const, lastSeenAt: new Date() }; demoIncident = incident; addDemoAudit(incident.code, ctx.user.name ?? ctx.user.openId, "INCIDENT_CREATED", `New search started at ${incident.venue}`); void writeAuditLog({ incidentCode: incident.code, actor: ctx.user.name ?? ctx.user.openId, action: "INCIDENT_CREATED", detail: `New search started at ${incident.venue}` }); emitIncidentEvent({ type: "incident_created", incidentCode: incident.code, payload: incident }); return incident; }),
    resolve: coordinatorOnly.input(z.object({ code: z.string().min(3) })).mutation(async ({ ctx, input }) => { const resolved = await resolveIncident(input.code); demoIncident = { ...demoIncident, status: "resolved" }; addDemoAudit(input.code, ctx.user.name ?? ctx.user.openId, "INCIDENT_RESOLVED", "Incident closed by coordinator"); void writeAuditLog({ incidentCode: input.code, actor: ctx.user.name ?? ctx.user.openId, action: "INCIDENT_RESOLVED", detail: "Incident closed by coordinator" }); emitIncidentEvent({ type: "incident_resolved", incidentCode: input.code, payload: { code: input.code } }); return resolved ?? demoIncident; }),
    reportSighting: protectedProcedure.input(z.object({ zone: z.string().min(1), label: z.string().min(1), source: z.string().min(1), confidence: z.number().int().min(0).max(100), urgent: z.boolean().optional() })).mutation(async ({ ctx, input }) => { const { urgent = false, ...sightingInput } = input; const incident = await ensureIncident({ code: DEMO_INCIDENT.code, title: DEMO_INCIDENT.title, venue: DEMO_INCIDENT.venue, lastSeenZone: DEMO_INCIDENT.lastSeenZone, lastSeenAt: DEMO_INCIDENT.lastSeenAt }); const saved = incident ? await insertSighting({ incidentId: incident.id, ...sightingInput, reportedBy: ctx.user.openId }) : undefined; const sighting = saved ?? { id: Date.now(), incidentId: 1, ...sightingInput, reportedBy: ctx.user.openId, createdAt: new Date() }; if (!saved) demoSightings = [sighting, ...demoSightings].slice(0, 20); const isUrgent = urgent || input.confidence >= 80; addDemoAudit("CX1008", ctx.user.name ?? ctx.user.openId, isUrgent ? "URGENT_SIGHTING" : "SIGHTING_REPORTED", `${input.label} near ${input.zone}`); void writeAuditLog({ incidentCode: "CX1008", actor: ctx.user.name ?? ctx.user.openId, action: isUrgent ? "URGENT_SIGHTING" : "SIGHTING_REPORTED", detail: `${input.label} near ${input.zone}` }); emitIncidentEvent({ type: "sighting_reported", incidentCode: "CX1008", payload: { ...sighting, urgent: isUrgent } }); emitIncidentEvent({ type: "ai_recalculated", incidentCode: "CX1008", payload: { reason: "new sighting", zone: input.zone } }); return sighting; }),
    markZoneSearched: protectedProcedure.input(z.object({ zone: z.string().min(1) })).mutation(({ ctx, input }) => { addDemoAudit("CX1008", ctx.user.name ?? ctx.user.openId, "ZONE_COMPLETED", `Zone ${input.zone} marked searched`); void writeAuditLog({ incidentCode: "CX1008", actor: ctx.user.name ?? ctx.user.openId, action: "ZONE_COMPLETED", detail: `Zone ${input.zone} marked searched` }); emitIncidentEvent({ type: "zone_completed", incidentCode: "CX1008", payload: { zone: input.zone } }); emitIncidentEvent({ type: "assignment_changed", incidentCode: "CX1008", payload: { zone: input.zone, reason: "zone completed" } }); return { success: true, zone: input.zone }; }),
    auditLogs: coordinatorOnly.input(z.object({ code: z.string().min(3) })).query(async ({ input }) => { const rows = await listAuditLogs(input.code); return rows.length ? rows : demoAuditLogs.filter((log) => log.incidentCode === input.code); }),
    exportReport: coordinatorOnly.input(z.object({ code: z.string().min(3) })).query(async ({ input }) => { const incident = await getIncidentByCode(input.code) ?? demoIncident; const rows = incident.id ? await listSightings(incident.id) : []; const auditLogs = await listAuditLogs(input.code); return { incident, sightings: rows.length ? rows : demoSightings, auditLogs: auditLogs.length ? auditLogs : demoAuditLogs.filter((log) => log.incidentCode === input.code), exportedAt: new Date() }; }),
    seed: coordinatorOnly.mutation(async () => { const db = await getDb(); if (!db) return DEMO_INCIDENT; const existing = await getIncidentByCode("CX1008"); if (existing) return existing; const result = await db.insert(incidents).values({ code: "CX1008", title: DEMO_INCIDENT.title, venue: DEMO_INCIDENT.venue, lastSeenZone: DEMO_INCIDENT.lastSeenZone, lastSeenAt: DEMO_INCIDENT.lastSeenAt }); return { ...DEMO_INCIDENT, id: Number(result[0].insertId) }; }),
  }),
  admin: router({
    users: coordinatorOnly.query(async () => { const rows = await listUsers(); return rows.length ? rows : demoUsers; }),
    setRole: coordinatorOnly.input(z.object({ id: z.number().int(), role: z.enum(["admin", "user"]) })).mutation(async ({ ctx, input }) => { const updated = await updateUserRole(input.id, input.role); demoUsers = demoUsers.map((user) => user.id === input.id ? { ...user, role: input.role } : user); addDemoAudit("SYSTEM", ctx.user.name ?? ctx.user.openId, "ROLE_UPDATED", `User ${input.id} set to ${input.role}`); void writeAuditLog({ incidentCode: "SYSTEM", actor: ctx.user.name ?? ctx.user.openId, action: "ROLE_UPDATED", detail: `User ${input.id} set to ${input.role}` }); return updated ?? demoUsers.find((user) => user.id === input.id) ?? { id: input.id, role: input.role }; }),
  }),
  volunteer: router({ updateLocation: protectedProcedure.input(z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().min(0).max(10000) })).mutation(({ ctx, input }) => { const volunteerId = ctx.user.openId; const location = { ...input, at: Date.now() }; liveLocations.set(volunteerId, location); emitIncidentEvent({ type: "volunteer_location_updated", incidentCode: "CX1008", payload: { volunteerId, ...location } }); return location; }) }),
});

export type AppRouter = typeof appRouter;
