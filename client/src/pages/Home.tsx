import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BatteryCharging,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Compass,
  Crosshair,
  Database,
  Flame,
  Gauge,
  HardHat,
  Info,
  Laptop,
  Layers3,
  LocateFixed,
  MapPinned,
  Menu,
  MessageSquareWarning,
  Navigation,
  Radio,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Send,
  ShieldCheck,
  Siren,
  Smartphone,
  Signal,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserRound,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { calculateSearchPriority, priorityForScore } from "@shared/searchgrid";
import LiveVenueMap from "@/components/LiveVenueMap";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIncidentRealtime, type IncidentRealtimeEvent } from "@/hooks/useIncidentRealtime";
import AdminPanel from "@/pages/AdminPanel";

type Mode = "command" | "volunteer" | "admin";
type ZoneStatus = "searching" | "queued" | "covered" | "alert";
type Priority = "HIGH" | "MEDIUM" | "LOW";

type Zone = {
  id: string;
  name: string;
  score: number;
  baseScore: number;
  priority: Priority;
  status: ZoneStatus;
  assigned: string | null;
  volunteers: number;
  x: number;
  y: number;
  w: number;
  h: number;
  features: string[];
  color: string;
};

type Sighting = {
  id: number;
  label: string;
  location: string;
  time: string;
  source: string;
  confidence: number;
};

const ZONE_SEEDS: Zone[] = [
  { id: "A", name: "Main Gate", score: 91, baseScore: 91, priority: "HIGH", status: "covered", assigned: "V02", volunteers: 2, x: 7, y: 67, w: 20, h: 20, features: ["Primary ingress", "High crowd flow", "Covered 4 min ago"], color: "coral" },
  { id: "B", name: "Food Court", score: 86, baseScore: 86, priority: "HIGH", status: "searching", assigned: "V07", volunteers: 3, x: 31, y: 14, w: 21, h: 25, features: ["Last seen 2 min ago", "Dense crowd", "Connected walkway"], color: "amber" },
  { id: "C", name: "Stage Plaza", score: 72, baseScore: 72, priority: "HIGH", status: "searching", assigned: "V03", volunteers: 2, x: 55, y: 12, w: 22, h: 26, features: ["Movement direction", "Open sightline", "Stage event active"], color: "orange" },
  { id: "D", name: "Children Area", score: 68, baseScore: 68, priority: "HIGH", status: "queued", assigned: "V11", volunteers: 2, x: 79, y: 14, w: 14, h: 25, features: ["High relevance", "Low obstruction", "North route"], color: "orange" },
  { id: "E", name: "West Walkway", score: 57, baseScore: 57, priority: "MEDIUM", status: "queued", assigned: "V14", volunteers: 1, x: 8, y: 42, w: 19, h: 17, features: ["Connected pathway", "Medium flow", "Partially searched"], color: "yellow" },
  { id: "F", name: "Central Lawn", score: 49, baseScore: 49, priority: "MEDIUM", status: "queued", assigned: "V09", volunteers: 2, x: 31, y: 43, w: 21, h: 21, features: ["Wide open area", "Cross-path junction", "Search next"], color: "yellow" },
  { id: "G", name: "East Walkway", score: 42, baseScore: 42, priority: "MEDIUM", status: "queued", assigned: "V18", volunteers: 1, x: 56, y: 43, w: 20, h: 21, features: ["Exit route", "Moderate flow", "No recent reports"], color: "blue" },
  { id: "H", name: "Medical Center", score: 36, baseScore: 36, priority: "LOW", status: "queued", assigned: "V21", volunteers: 1, x: 80, y: 44, w: 13, h: 19, features: ["Staffed checkpoint", "Low crowd", "Checked at 13:12"], color: "blue" },
  { id: "I", name: "Parking Loop", score: 30, baseScore: 30, priority: "LOW", status: "queued", assigned: "V04", volunteers: 1, x: 8, y: 76, w: 20, h: 15, features: ["Peripheral route", "Vehicle barrier", "Low probability"], color: "blue" },
  { id: "J", name: "Service Road", score: 27, baseScore: 27, priority: "LOW", status: "queued", assigned: "V16", volunteers: 1, x: 32, y: 70, w: 20, h: 13, features: ["Restricted access", "Low flow", "Perimeter route"], color: "blue" },
  { id: "K", name: "Gate B", score: 24, baseScore: 24, priority: "LOW", status: "queued", assigned: "V12", volunteers: 1, x: 57, y: 70, w: 19, h: 13, features: ["Secondary ingress", "Low flow", "Checked 3 min ago"], color: "blue" },
  { id: "L", name: "Restrooms", score: 18, baseScore: 18, priority: "LOW", status: "queued", assigned: "V20", volunteers: 1, x: 81, y: 69, w: 12, h: 14, features: ["Fixed feature", "Low flow", "Monitored"], color: "blue" },
];

const INITIAL_SIGHTINGS: Sighting[] = [
  { id: 1, label: "Possible sighting", location: "Food Court · north aisle", time: "2 min ago", source: "Volunteer V07", confidence: 82 },
  { id: 2, label: "Route update", location: "Main Gate · west approach", time: "6 min ago", source: "CCTV handoff", confidence: 64 },
  { id: 3, label: "Zone cleared", location: "Parking Loop", time: "9 min ago", source: "Volunteer V04", confidence: 93 },
];

const VOLUNTEERS = ["V02", "V03", "V04", "V07", "V09", "V11", "V12", "V14", "V16", "V18", "V20", "V21"];

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function IconBadge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "mint" | "red" | "amber" | "slate" | "blue" }) {
  return <span className={cn("icon-badge", `icon-badge-${tone}`)}>{children}</span>;
}

function LivePill({ children, tone = "mint" }: { children: React.ReactNode; tone?: "mint" | "red" | "amber" | "blue" }) {
  return <span className={cn("live-pill", `live-pill-${tone}`)}>{children}</span>;
}

function ScoreBar({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <div className={cn("score-bar", compact && "score-bar-compact")}>
      <div className="score-bar-track"><span style={{ width: `${score}%` }} /></div>
      <strong>{score}%</strong>
    </div>
  );
}

function VenueMap({ zones, selectedId, onSelect, volunteerLocations }: { zones: Zone[]; selectedId: string; onSelect: (zone: Zone) => void; volunteerLocations: Record<string, { lat: number; lng: number; accuracy: number }> }) {
  return <LiveVenueMap zones={zones} selectedId={selectedId} volunteerLocations={volunteerLocations} onSelect={(mapZone) => onSelect(zones.find((zone) => zone.id === mapZone.id) ?? zones[0])} />;
}

function CommandCenter({ onModeChange, mode }: { onModeChange: (mode: Mode) => void; mode: Mode }) {
  const { user } = useAuth();
  const incidentQuery = trpc.incident.current.useQuery();
  const reportMutation = trpc.incident.reportSighting.useMutation();
  const markMutation = trpc.incident.markZoneSearched.useMutation();
  const [zones, setZones] = useState<Zone[]>(ZONE_SEEDS);
  const [selectedId, setSelectedId] = useState("B");
  const [sightings, setSightings] = useState<Sighting[]>(INITIAL_SIGHTINGS);
  const [elapsed, setElapsed] = useState(2);
  const [now, setNow] = useState(new Date("2026-09-14T13:17:43+05:30"));
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [toast, setToast] = useState("");
  const [sightingBoost, setSightingBoost] = useState(12);
  const [volunteerLocations, setVolunteerLocations] = useState<Record<string, { lat: number; lng: number; accuracy: number }>>({});

  const handleRealtime = useCallback((event: IncidentRealtimeEvent) => {
    if (event.type === "sighting_reported") {
      const payload = event.payload as { id?: number; label?: string; zone?: string; source?: string; confidence?: number };
      setSightings((current) => [{ id: payload.id ?? Date.now(), label: payload.label ?? "Live sighting", location: payload.zone ?? "Venue update", time: "just now", source: payload.source ?? "Live volunteer", confidence: payload.confidence ?? 75 }, ...current].slice(0, 4));
      setSelectedId("B");
      setSightingBoost((value) => Math.min(30, value + 4));
      setToast("Live sighting received · AI priorities recalculated");
    }
    if (event.type === "zone_completed") {
      const zone = String(event.payload.zone ?? "");
      setZones((current) => current.map((item) => item.id === zone || item.name === zone ? { ...item, status: "covered", score: Math.max(8, item.score - 26), priority: priorityForScore(Math.max(8, item.score - 26)) } : item));
      setToast(`Live update · ${zone} marked searched`);
    }
    if (event.type === "ai_recalculated" || event.type === "assignment_changed") setToast("Live operations update · assignments refreshed");
    if (event.type === "volunteer_location_updated") {
      const payload = event.payload as { volunteerId?: string; lat?: number; lng?: number; accuracy?: number };
      if (payload.volunteerId && payload.lat !== undefined && payload.lng !== undefined) setVolunteerLocations((current) => ({ ...current, [payload.volunteerId as string]: { lat: payload.lat as number, lng: payload.lng as number, accuracy: payload.accuracy ?? 0 } }));
    }
  }, []);

  useIncidentRealtime("CX1008", handleRealtime);

  useEffect(() => {
    const rows = incidentQuery.data?.sightings;
    if (!rows?.length) return;
    setSightings(rows.map((row) => ({ id: row.id, label: row.label, location: row.zone, time: new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), source: row.source, confidence: row.confidence })));
  }, [incidentQuery.data]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow((value) => new Date(value.getTime() + 1000)), 1000);
    const demo = window.setInterval(() => {
      setElapsed((value) => value + 1);
      setZones((current) => current.map((zone) => {
        if (zone.status === "covered") return zone;
        const score = calculateSearchPriority(zone, sightingBoost, elapsed + 1);
        return { ...zone, score, priority: priorityForScore(score) };
      }));
    }, 7000);
    return () => { window.clearInterval(clock); window.clearInterval(demo); };
  }, [elapsed, sightingBoost]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selected = zones.find((zone) => zone.id === selectedId) ?? zones[1];
  const rankedZones = useMemo(() => [...zones].sort((a, b) => b.score - a.score), [zones]);
  const coveredCount = zones.filter((zone) => zone.status === "covered").length;
  const activeCount = zones.filter((zone) => zone.status === "searching").length;
  const highPriorityCount = zones.filter((zone) => zone.priority === "HIGH" && zone.status !== "covered").length;

  const recalculate = (reason: string) => {
    setIsRecalculating(true);
    setSightingBoost((value) => Math.min(26, value + 4));
    window.setTimeout(() => {
      setZones((current) => current.map((zone) => {
        const score = calculateSearchPriority(zone, sightingBoost + 4, elapsed);
        return { ...zone, score, priority: priorityForScore(score), status: zone.status === "covered" ? "covered" : zone.id === "B" ? "alert" : zone.status };
      }));
      setIsRecalculating(false);
      setToast(`AI model recalculated · ${reason}`);
    }, 700);
  };

  const markSearched = (id: string) => {
    setZones((current) => current.map((zone) => zone.id === id ? { ...zone, status: "covered", score: Math.max(8, zone.score - 26), priority: priorityForScore(Math.max(8, zone.score - 26)) } : zone));
    setToast(`Zone ${id} marked searched · assignments replanned`);
    markMutation.mutate({ zone: id }, { onError: () => setToast(`Zone ${id} marked locally · sign in to broadcast to the team`) });
  };

  const reportSighting = () => {
    const sighting: Sighting = { id: Date.now(), label: "New possible sighting", location: "Central Lawn · east path", time: "just now", source: "Coordinator demo", confidence: 76 };
    setSightings((current) => [sighting, ...current].slice(0, 4));
    setSelectedId("B");
    reportMutation.mutate({ zone: sighting.location, label: sighting.label, source: user?.name ?? "Coordinator demo", confidence: sighting.confidence }, { onError: () => setToast("Sighting added locally · sign in to broadcast live") });
    recalculate("new sighting near Central Lawn");
  };

  const roleLabel = user?.role === "admin" ? "COORDINATOR" : user ? "VOLUNTEER" : "DEMO OPS";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><Crosshair size={21} strokeWidth={2.2} /></div><div><div className="brand-name">SEARCHGRID <span>AI</span></div><div className="brand-subtitle">EMERGENCY SEARCH COORDINATION</div></div></div>
        <div className="topbar-center"><LivePill><span className="status-dot" /> SYSTEM ONLINE</LivePill><span className="incident-label"><Siren size={14} /> MISSING PERSON — ACTIVE</span></div>
        <div className="topbar-actions"><div className="time-readout"><span>{formatClock(now)}</span><small>LOCAL TIME · UTC+05:30</small></div><button className="icon-button" aria-label="Notifications"><Bell size={17} /><i /></button><button className="avatar-button">{user?.name?.slice(0, 2).toUpperCase() ?? "OC"}<span>{roleLabel}</span></button></div>
      </header>

      <div className="view-switcher"><div className="view-switcher-inner"><button className={cn(mode === "command" && "active")} onClick={() => onModeChange("command")}><Laptop size={15} /> Command Center</button><button className={cn(mode === "volunteer" && "active")} onClick={() => onModeChange("volunteer")}><Smartphone size={15} /> Volunteer PWA</button><button className={cn(mode === "admin" && "active")} onClick={() => onModeChange("admin")}><ShieldCheck size={15} /> Admin</button></div><div className="sync-strip"><Wifi size={13} /> Live sync <span>•</span> Last update {formatClock(now)}</div></div>

      <main className="dashboard-content">
        <div className="page-heading"><div><p className="eyebrow">INCIDENT  /  CX1008  /  ROUND 1</p><h1>City Festival Ground <span>·</span> <em>Live Operations</em></h1></div><div className="heading-actions"><button className="secondary-button" onClick={() => setShowIncidentForm(true)}><SlidersHorizontal size={16} /> Incident details</button><button className="primary-button" onClick={reportSighting}><MessageSquareWarning size={16} /> Report sighting</button></div></div>

        <div className="kpi-grid">
          <div className="kpi-card accent-red"><div className="kpi-top"><span>SEARCH PRIORITY</span><IconBadge tone="red"><Flame size={16} /></IconBadge></div><div className="kpi-value">HIGH <ArrowUpRight size={20} /></div><div className="kpi-foot"><span className="trend-up">+14%</span> since last update</div></div>
          <div className="kpi-card accent-mint"><div className="kpi-top"><span>ACTIVE VOLUNTEERS</span><IconBadge tone="mint"><Users size={16} /></IconBadge></div><div className="kpi-value">24 <small>/ 31</small></div><div className="kpi-foot"><span className="trend-up">77%</span> availability</div></div>
          <div className="kpi-card accent-blue"><div className="kpi-top"><span>ZONES COVERED</span><IconBadge tone="blue"><MapPinned size={16} /></IconBadge></div><div className="kpi-value">{coveredCount} <small>/ {zones.length}</small></div><div className="kpi-foot"><div className="mini-progress"><span style={{ width: `${(coveredCount / zones.length) * 100}%` }} /></div><span>{Math.round((coveredCount / zones.length) * 100)}%</span></div></div>
          <div className="kpi-card accent-amber"><div className="kpi-top"><span>TOP PRIORITY ZONE</span><IconBadge tone="amber"><Target size={16} /></IconBadge></div><div className="kpi-value">Zone {rankedZones[0].id} <small>— {rankedZones[0].score}%</small></div><div className="kpi-foot"><span className="trend-neutral">{rankedZones[0].name}</span> · reassigned 32s ago</div></div>
        </div>

        <div className="command-grid">
          <section className="map-panel panel-card"><div className="panel-header"><div><div className="panel-kicker"><Radio size={13} /> PROBABILITY HEATMAP</div><h2>Venue search grid</h2></div><div className="panel-header-actions"><button className={cn("secondary-button small", isRecalculating && "button-loading")} onClick={() => recalculate("manual refresh")}><RefreshCw size={14} className={cn(isRecalculating && "spin")} /> {isRecalculating ? "Recalculating" : "Recalculate"}</button><button className="icon-button subtle" aria-label="Map options"><Menu size={16} /></button></div></div><div className="map-meta"><span><span className="pulse-dot" /> AI PRIORITIES LIVE</span><span>12 zones · {activeCount} actively searching</span><span>Coverage {coveredCount}/{zones.length}</span></div><VenueMap zones={zones} selectedId={selectedId} volunteerLocations={volunteerLocations} onSelect={(zone) => setSelectedId(zone.id)} /><div className="map-caption"><Info size={14} /><span>AI predictions are search priorities, not guaranteed locations.</span><button onClick={() => setToast("The model blends distance, time, crowd flow, pathway, sighting, venue feature and searched-area penalty.")}>How scoring works <ChevronRight size={13} /></button></div></section>

          <aside className="zone-panel panel-card"><div className="panel-header"><div><div className="panel-kicker"><Target size={13} /> SELECTED ZONE</div><h2>Zone {selected.id}</h2></div><span className={cn("status-tag", selected.status)}>{selected.status === "searching" ? "SEARCHING" : selected.status === "covered" ? "COVERED" : selected.status === "alert" ? "UPDATED" : "QUEUED"}</span></div><div className="zone-detail-name">{selected.name}</div><div className="priority-score"><span>AI SEARCH PRIORITY</span><strong>{selected.score}%</strong><ScoreBar score={selected.score} /></div><div className="why-block"><div className="why-title"><Sparkles size={14} /> WHY THIS ZONE?</div><ul>{selected.features.map((feature) => <li key={feature}><CheckCircle2 size={14} /> {feature}</li>)}</ul></div><div className="assignment-block"><div className="assignment-label">ASSIGNED SEARCH TEAM <span>{selected.volunteers} volunteers</span></div><div className="assigned-person"><div className="person-avatar">{selected.assigned ?? "—"}</div><div><strong>{selected.assigned ?? "Unassigned"}</strong><small>{selected.status === "searching" ? "On route · 180 m away" : "Available for dispatch"}</small></div><button className="icon-button subtle"><Navigation size={15} /></button></div></div><button className="full-button" onClick={() => markSearched(selected.id)} disabled={selected.status === "covered"}>{selected.status === "covered" ? <><CheckCircle2 size={16} /> Zone already covered</> : <><Check size={16} /> Mark zone searched</>}</button><div className="replan-note"><Zap size={13} /><span>Assignments update automatically when new sighting data arrives.</span></div></aside>
        </div>

        <div className="lower-grid"><section className="activity-panel panel-card"><div className="panel-header"><div><div className="panel-kicker"><Activity size={13} /> LIVE ACTIVITY</div><h2>Incident timeline</h2></div><LivePill tone="blue">{highPriorityCount} high priority</LivePill></div><div className="activity-list">{sightings.map((item, index) => <div className={cn("activity-row", index === 0 && "latest")} key={item.id}><div className={cn("activity-icon", index === 0 ? "activity-icon-red" : "activity-icon-blue")}><MessageSquareWarning size={15} /></div><div className="activity-copy"><strong>{item.label} <span>{item.confidence}% confidence</span></strong><p>{item.location}</p><small>{item.source} · {item.time}</small></div><button className="icon-button subtle"><ChevronRight size={15} /></button></div>)}</div><button className="link-button" onClick={() => setToast("Activity log is live for this demo incident.")}>View full activity log <ArrowUpRight size={14} /></button></section><section className="assignment-panel panel-card"><div className="panel-header"><div><div className="panel-kicker"><Users size={13} /> SMART ASSIGNMENTS</div><h2>Search queue</h2></div><button className="secondary-button small" onClick={() => recalculate("assignment refresh")}><RefreshCw size={14} /> Replan all</button></div><div className="queue-list">{rankedZones.slice(0, 5).map((zone, index) => <div className="queue-row" key={zone.id}><span className="queue-rank">0{index + 1}</span><div className={cn("queue-priority", zone.priority.toLowerCase())}>{zone.priority}</div><div className="queue-zone"><strong>Zone {zone.id} <span>· {zone.name}</span></strong><small>{zone.assigned ?? "Unassigned"} · {zone.status === "covered" ? "Complete" : index === 0 ? "Dispatch now" : "Queued"}</small></div><ScoreBar score={zone.score} compact /><ChevronRight size={15} className="queue-chevron" /></div>)}</div></section></div>

        <div className="bottom-notice"><div className="notice-icon"><ShieldCheck size={18} /></div><div><strong>Safety protocol enabled</strong><span>All volunteer locations are visible to coordinators only. Never use this score as a guaranteed location.</span></div><div className="notice-status"><span className="status-dot" /> Secure channel</div></div>
      </main>

      {toast && <div className="toast"><CheckCircle2 size={17} /><span>{toast}</span><button onClick={() => setToast("")}><X size={14} /></button></div>}
      {showIncidentForm && <div className="modal-backdrop" onClick={() => setShowIncidentForm(false)}><div className="incident-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><div className="panel-kicker">ACTIVE INCIDENT</div><h2>Missing person details</h2></div><button className="icon-button subtle" onClick={() => setShowIncidentForm(false)}><X size={17} /></button></div><div className="incident-person"><div className="person-photo">AR</div><div><strong>Arjun R.</strong><span>Child · 8 years · blue hoodie</span><small>Last seen at Food Court, facing north</small></div><LivePill tone="red">ACTIVE</LivePill></div><div className="modal-stats"><div><span>ELAPSED</span><strong>00:{String(elapsed).padStart(2, "0")}</strong></div><div><span>LAST SIGHTING</span><strong>Food Court</strong></div><div><span>CONFIDENCE</span><strong>82%</strong></div></div><div className="modal-note"><AlertTriangle size={15} /><span>Keep the child description and last-seen details current. New data shifts volunteer assignments.</span></div><button className="full-button" onClick={() => { setShowIncidentForm(false); setToast("Incident details are current · no changes needed"); }}>Close incident details</button></div></div>}
    </div>
  );
}

function VolunteerView({ onModeChange }: { onModeChange: (mode: Mode) => void }) {
  const { user } = useAuth();
  const reportMutation = trpc.incident.reportSighting.useMutation();
  const markMutation = trpc.incident.markZoneSearched.useMutation();
  const locationMutation = trpc.volunteer.updateLocation.useMutation();
  const [searched, setSearched] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState("");
  const handleRealtime = useCallback((event: IncidentRealtimeEvent) => {
    if (event.type === "zone_completed") setToast("Command center updated this zone");
    if (event.type === "assignment_changed") setToast("Assignment changed · refresh your mission");
  }, []);
  useIncidentRealtime("CX1008", handleRealtime);

  useEffect(() => {
    if (offline || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition((position) => {
      locationMutation.mutate({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy });
    }, () => setToast("GPS permission needed for live volunteer tracking"), { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [offline]);

  const completeSearch = () => {
    setSearched(true);
    setToast("Zone B marked searched · command center synced");
    if (!offline) markMutation.mutate({ zone: "B" }, { onError: () => setToast("Search logged locally · sign in to broadcast to the team") });
  };
  const startNavigation = () => {
    if (!navigator.geolocation) { setToast("GPS is not available on this device"); return; }
    navigator.geolocation.getCurrentPosition(() => setToast("GPS locked · route to Zone B is active"), () => setToast("GPS permission needed for live navigation"), { enableHighAccuracy: true, timeout: 5000 });
  };
  return <div className="volunteer-shell"><header className="volunteer-topbar"><button className="volunteer-brand" onClick={() => onModeChange("command")}><span className="brand-mark"><Crosshair size={19} /></span><span>SEARCHGRID <b>AI</b></span></button><div className="volunteer-status"><span className="status-dot" /> {offline ? "OFFLINE MODE" : `LIVE SYNC · ${user?.name ?? "DEMO"}`}</div><button className="icon-button subtle" onClick={() => setOffline((value) => !value)}>{offline ? <WifiOff size={17} /> : <Wifi size={17} />}</button></header><main className="volunteer-main"><div className="volunteer-incident"><div><span className="eyebrow">ACTIVE SEARCH · CX1008</span><h1>Find Arjun R.</h1><p>City Festival Ground · incident started 13:15</p></div><div className="volunteer-siren"><Siren size={19} /><span>ACTIVE</span></div></div><div className="mission-card"><div className="mission-top"><div><span className="panel-kicker">YOUR ASSIGNMENT</span><h2>Zone B <span>· Food Court</span></h2></div><LivePill tone="red">{searched ? "SEARCHED" : "SEARCH NOW"}</LivePill></div><div className="mission-score"><div className="mission-score-number">86<span>%</span></div><div><strong>AI SEARCH PRIORITY</strong><p>Highest probability area right now</p></div></div><div className="assignment-route"><div className="route-icon"><RouteIcon size={20} /></div><div><strong>180 m to your zone</strong><p>Take the north walkway · approx. 2 min</p></div><button className="primary-button" onClick={startNavigation}><Navigation size={16} /> Navigate</button></div><div className="mission-reasons"><span><Check size={13} /> Last seen nearby</span><span><Check size={13} /> High crowd flow</span><span><Check size={13} /> Connected pathway</span></div></div><div className="volunteer-map-mini"><div className="mini-map-grid" /><div className="mini-route" /><div className="mini-location"><span /><small>YOU</small></div><div className="mini-destination"><Target size={17} /><small>ZONE B</small></div><div className="mini-map-label food">FOOD COURT</div><div className="mini-map-label stage">STAGE</div><div className="mini-map-cta"><Compass size={15} /><span>North walkway</span><strong>2 min</strong></div></div><div className="volunteer-actions"><button className="full-button" onClick={completeSearch} disabled={searched}>{searched ? <><CheckCircle2 size={17} /> Search logged</> : <><Check size={17} /> Mark zone searched</>}</button><button className="secondary-button full-button-secondary" onClick={() => setReportOpen(true)}><MessageSquareWarning size={17} /> Report a sighting</button></div><div className="volunteer-status-card"><div className="status-card-row"><IconBadge tone="mint"><BatteryCharging size={16} /></IconBadge><div><strong>Device ready</strong><span>Battery 84% · GPS accuracy high</span></div><CheckCircle2 size={16} className="check-green" /></div><div className="status-card-row"><IconBadge tone="blue"><RefreshCw size={16} /></IconBadge><div><strong>{offline ? "Waiting to sync" : "All changes synced"}</strong><span>{offline ? "Will send when connection returns" : "Last sync just now"}</span></div><span className={cn("sync-indicator", offline && "sync-offline")} /></div></div><div className="volunteer-disclaimer"><Info size={14} /><span>AI predictions are search priorities, not guaranteed locations. Stay with your team and follow coordinator instructions.</span></div></main><nav className="volunteer-nav"><button className="active"><Target size={18} /><span>Mission</span></button><button><MapPinned size={18} /><span>Map</span></button><button onClick={() => onModeChange("command")}><Radio size={18} /><span>Command</span></button><button><UserRound size={18} /><span>Profile</span></button></nav>{toast && <div className="toast mobile-toast"><CheckCircle2 size={17} /><span>{toast}</span></div>}{reportOpen && <div className="modal-backdrop" onClick={() => setReportOpen(false)}><div className="incident-modal volunteer-report-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><div className="panel-kicker">QUICK REPORT</div><h2>Report a sighting</h2></div><button className="icon-button subtle" onClick={() => setReportOpen(false)}><X size={17} /></button></div><button className="report-option active"><CircleDot size={17} /><span><strong>Possible sighting</strong><small>Someone matching the description</small></span><Check size={16} /></button><button className="report-option"><MapPinned size={17} /><span><strong>Area needs help</strong><small>Request another volunteer here</small></span></button><button className="report-option"><AlertTriangle size={17} /><span><strong>Safety issue</strong><small>Blocked path or urgent concern</small></span></button><button className="full-button" onClick={() => { reportMutation.mutate({ zone: "Food Court", label: "Possible sighting", source: user?.name ?? "Volunteer demo", confidence: 76 }); setReportOpen(false); setToast("Report sent to the command center"); }}><Send size={16} /> Send report</button></div></div>}</div>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>(() => window.location.hash === "#volunteer" ? "volunteer" : window.location.hash === "#admin" ? "admin" : "command");
  const changeMode = (nextMode: Mode) => { setMode(nextMode); window.history.replaceState({}, "", nextMode === "volunteer" ? "#volunteer" : nextMode === "admin" ? "#admin" : "#command"); };
  return mode === "volunteer" ? <VolunteerView onModeChange={changeMode} /> : mode === "admin" ? <AdminPanel onBack={() => changeMode("command")} /> : <CommandCenter mode={mode} onModeChange={changeMode} />;
}
