import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { Server as SocketServer } from "socket.io";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { incidentEvents } from "../incidentEvents";
import { sdk } from "./sdk";
import { createIncidentBackup } from "../opsServices";

function isPortAvailable(port: number): Promise<boolean> { return new Promise(resolve => { const server = net.createServer(); server.listen(port, () => server.close(() => resolve(true))); server.on("error", () => resolve(false)); }); }
async function findAvailablePort(startPort = 3000): Promise<number> { for (let port = startPort; port < startPort + 20; port++) if (await isPortAvailable(port)) return port; throw new Error(`No available port found starting from ${startPort}`); }

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new SocketServer(server, { cors: { origin: true, credentials: true } });
  io.on("connection", (socket) => { socket.emit("connectivity_changed", { connected: true, at: Date.now() }); socket.on("join_incident", (code: string) => socket.join(`incident:${code}`)); });
  incidentEvents.on("incident", (event) => io.to(`incident:${event.incidentCode}`).emit(event.type, event));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/scheduled/backupAuditReports", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const backup = await createIncidentBackup("CX1008");
      return res.json({ ok: true, taskUid: user.taskUid, backup });
    } catch (error) {
      return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
    }
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server); else serveStatic(app);
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}
startServer().catch(console.error);
