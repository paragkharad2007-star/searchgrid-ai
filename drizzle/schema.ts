import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 160 }).notNull(),
  venue: varchar("venue", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["active", "resolved"]).default("active").notNull(),
  lastSeenZone: varchar("lastSeenZone", { length: 80 }).notNull(),
  lastSeenAt: timestamp("lastSeenAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const sightings = mysqlTable("sightings", {
  id: int("id").autoincrement().primaryKey(),
  incidentId: int("incidentId").notNull(),
  zone: varchar("zone", { length: 80 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  source: varchar("source", { length: 120 }).notNull(),
  confidence: int("confidence").notNull(),
  reportedBy: varchar("reportedBy", { length: 80 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type Sighting = typeof sightings.$inferSelect;
