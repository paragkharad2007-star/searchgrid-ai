import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import { getIncidentByCode, listAuditLogs, listSightings } from "./db";

export async function dispatchUrgentEscalation(input: { incidentCode: string; title: string; detail: string }) {
  const ownerNotified = await notifyOwner({ title: `URGENT SEARCHGRID ALERT · ${input.incidentCode}`, content: `${input.title}\n${input.detail}\nOpen the command center for live response.` });
  const webhooks = [process.env.URGENT_EMAIL_WEBHOOK_URL, process.env.URGENT_SMS_WEBHOOK_URL].filter((url): url is string => Boolean(url));
  const webhookResults = await Promise.all(webhooks.map(async (url) => { try { const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ incidentCode: input.incidentCode, title: input.title, detail: input.detail, channel: url === process.env.URGENT_SMS_WEBHOOK_URL ? "sms" : "email" }) }); return response.ok; } catch { return false; } }));
  return { ownerNotified, configuredChannels: webhooks.length, deliveredChannels: webhookResults.filter(Boolean).length };
}

export async function createIncidentBackup(code: string) {
  const incident = await getIncidentByCode(code);
  const sightings = incident ? await listSightings(incident.id) : [];
  const auditLogs = await listAuditLogs(code);
  const payload = JSON.stringify({ incident, sightings, auditLogs, backedUpAt: new Date().toISOString() }, null, 2);
  return storagePut(`searchgrid-backups/${code}.json`, payload, "application/json");
}
