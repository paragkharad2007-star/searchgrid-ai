import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, incidents, sightings, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getIncidentByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(incidents).where(eq(incidents.code, code)).limit(1);
  return result[0];
}

export async function ensureIncident(input: { code: string; title: string; venue: string; lastSeenZone: string; lastSeenAt: Date }) {
  const existing = await getIncidentByCode(input.code);
  if (existing) return existing;
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(incidents).values(input);
  return getIncidentByCode(input.code);
}

export async function listSightings(incidentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sightings).where(eq(sightings.incidentId, incidentId)).orderBy(desc(sightings.createdAt)).limit(20);
}

export async function insertSighting(input: { incidentId: number; zone: string; label: string; source: string; confidence: number; reportedBy?: string }) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(sightings).values(input);
  const rows = await db.select().from(sightings).where(eq(sightings.incidentId, input.incidentId)).orderBy(desc(sightings.createdAt)).limit(1);
  return rows[0];
}
