import { formatMs, formatUsd } from "@/lib/ai/pricing";
import { maxSustainableRate, percentile } from "@/lib/bench/metrics";
import type { ChatMessage } from "@/lib/data/chat";

export const PILOTS = ["laya", "jev", "human"] as const;
export type Pilot = (typeof PILOTS)[number];
export const RATE_KEYS = [1, 2, 4, 8, 12, 20, 30, 40] as const;
export const WINDOW_MS = 4000;
export const SETTLE_MS = 2500;
export const P95_LIMIT_MS = 2000;
export const RAMP_MS = WINDOW_MS * RATE_KEYS.length;
export const MAX_CHAT_LINES = 140;
export const TRAIL_MAX = 80;
export const SATURATED_QUEUE = 50;
export const SATURATED_P95_MS = 5000;
export const CONCURRENCY: Record<Pilot, number> = { laya: 1, jev: 8, human: 1 };

export const mustBlock = (item: ChatMessage) => item.toxic || item.spam;

export type BreakInfo = { rate: number; reason: "dropped" | "latency" | "queue"; detail: string };
export type LineStatus = "pending" | "approved" | "removed" | "missed" | "break";
export type ChatLine = {
  uid: string;
  item: ChatMessage;
  at: number;
  status: LineStatus;
  late: boolean;
  verdict?: { blocked: boolean; correct: boolean };
  marker?: BreakInfo;
};

export type WindowSample = { rate: number; p95Ms: number; pending: number; completed: number; dropped: number };
export type ErrorKind = "false_block" | "slipped" | "missed";
export type ErrorExample = { kind: ErrorKind; user: string; text: string; note: string };
export type LatencyPoint = { at: number; ms: number };

export type Report = {
  windows: WindowSample[];
  correct: number;
  completed: number;
  arrived: number;
  dropped: number;
  falseBlocks: number;
  slipped: number;
  latencies: number[];
  latencyEvents: LatencyPoint[];
  costUsd: number;
  queueTrail: number[];
  p95Trail: number[];
  errors: ErrorExample[];
  broke: BreakInfo | null;
};

export type LiveStats = {
  rate: number;
  targetRate: number;
  elapsedMs: number;
  pending: number;
  arrived: number;
  completed: number;
  dropped: number;
  correct: number;
  falseBlocks: number;
  slipped: number;
  p95Ms: number;
  p95Trail: number[];
  queueTrail: number[];
  broke: BreakInfo | null;
  saturated: boolean;
};

export function emptyReport(): Report {
  return { windows: [], correct: 0, completed: 0, arrived: 0, dropped: 0, falseBlocks: 0, slipped: 0, latencies: [], latencyEvents: [], costUsd: 0, queueTrail: [], p95Trail: [], errors: [], broke: null };
}

export function emptyLive(): LiveStats {
  return { rate: 0, targetRate: 0, elapsedMs: 0, pending: 0, arrived: 0, completed: 0, dropped: 0, correct: 0, falseBlocks: 0, slipped: 0, p95Ms: 0, p95Trail: [], queueTrail: [], broke: null, saturated: false };
}

export function targetRate(elapsedMs: number) {
  const t = Math.max(0, Math.min(RAMP_MS, elapsedMs));
  const idx = Math.min(RATE_KEYS.length - 1, Math.floor(t / WINDOW_MS));
  if (idx >= RATE_KEYS.length - 1) return RATE_KEYS[RATE_KEYS.length - 1];
  const local = (t - idx * WINDOW_MS) / WINDOW_MS;
  return RATE_KEYS[idx] + (RATE_KEYS[idx + 1] - RATE_KEYS[idx]) * local;
}

export function poissonWaitMs(rate: number) {
  const lambda = Math.max(0.25, rate);
  return -Math.log(1 - Math.max(1e-9, Math.random())) / lambda * 1000;
}

export function arrivalsInWindow(times: number[], elapsedMs: number, windowMs = WINDOW_MS) {
  const from = elapsedMs - windowMs;
  let count = 0;
  for (let index = times.length - 1; index >= 0; index--) {
    if (times[index] < from) break;
    count++;
  }
  return count;
}

export function measuredRate(times: number[], elapsedMs: number, windowMs = WINDOW_MS) {
  const span = Math.min(windowMs, Math.max(elapsedMs, 1));
  return arrivalsInWindow(times, elapsedMs, windowMs) / (span / 1000);
}

export function queueCap(rate: number) {
  return Math.max(8, rate * 2);
}

export function windowFailed(sample: WindowSample, limitMs = P95_LIMIT_MS) {
  return sample.p95Ms > limitMs || sample.pending > sample.rate * 2 || (sample.dropped ?? 0) > 0;
}

export function failReason(sample: WindowSample): "dropped" | "latency" | "queue" {
  if ((sample.dropped ?? 0) > 0) return "dropped";
  if (sample.p95Ms > P95_LIMIT_MS) return "latency";
  return "queue";
}

export function describeBreak(sample: WindowSample): BreakInfo {
  const reason = failReason(sample);
  const detail = reason === "dropped"
    ? `se perdieron ${sample.dropped} mensaje${sample.dropped === 1 ? "" : "s"}`
    : reason === "latency"
      ? `el p95 subió a ${formatMs(sample.p95Ms)} (límite 2 s)`
      : `la cola llegó a ${sample.pending} (más del doble de ${sample.rate} msg/s)`;
  return { rate: sample.rate, reason, detail };
}

export function breakHeadline(broke: BreakInfo, sustainable: number) {
  const held = sustainable > 0 ? ` Ritmo sostenible: ${sustainable} msg/s.` : " No llegó a sostener 1 msg/s.";
  return `El stream se rompió a ${broke.rate} msg/s porque ${broke.detail}.${held}`;
}

export function snapshotWindow(rate: number, latencies: number[], pending: number, dropped: number): WindowSample {
  const p95Ms = latencies.length ? percentile(latencies, 0.95) : dropped ? Number.POSITIVE_INFINITY : 0;
  return { rate, p95Ms, pending, completed: latencies.length, dropped };
}

export function liveP95(events: LatencyPoint[], now: number, windowMs = WINDOW_MS) {
  const recent = events.filter(point => now - point.at <= windowMs).map(point => point.ms);
  return recent.length ? percentile(recent, 0.95) : 0;
}

export function pushTrail(trail: number[], value: number, max = TRAIL_MAX) {
  trail.push(value);
  if (trail.length > max) trail.shift();
}

export function visibleLines(lines: Map<string, ChatLine>, now: number) {
  const lateAfter = P95_LIMIT_MS;
  const all = [...lines.values()];
  const sliced = all.length > MAX_CHAT_LINES ? all.slice(all.length - MAX_CHAT_LINES) : all;
  return sliced.map(line => line.status === "break" || line.status !== "pending" || now - line.at <= lateAfter ? line : { ...line, late: true });
}

export function pilotLabel(pilot: Pilot) {
  if (pilot === "human") return "una persona";
  return pilot === "jev" ? "Jev" : "Laya";
}

export function pilotShort(pilot: Pilot) {
  if (pilot === "human") return "Persona";
  return pilot === "jev" ? "Jev" : "Laya";
}

export function removedLabel(pilot: Pilot) {
  if (pilot === "human") return "<mensaje eliminado por el moderador>";
  return `<mensaje eliminado por ${pilot === "jev" ? "Jev" : "Laya"}>`;
}

export function exampleFrom(item: ChatMessage, kind: ErrorKind): ErrorExample {
  const clip = item.text.length > 72 ? `${item.text.slice(0, 69)}...` : item.text;
  const note = kind === "false_block"
    ? `«${clip}» de ${item.user.name} se eliminó, pero no era tóxico ni spam.`
    : kind === "slipped"
      ? `«${clip}» de ${item.user.name} se quedó en el chat. Era ${item.toxic ? "un insulto" : "spam"} y había que bloquearlo.`
      : `«${clip}» de ${item.user.name} no se revisó a tiempo.`;
  return { kind, user: item.user.name, text: item.text, note };
}

export function pickErrors(errors: ErrorExample[]) {
  const picked: ErrorExample[] = [];
  for (const kind of ["slipped", "false_block", "missed"] as const) {
    const hit = errors.find(item => item.kind === kind);
    if (hit) picked.push(hit);
  }
  return picked.length ? picked : errors.slice(0, 3);
}

export function buildSummary(report: Report, pilot: Pilot) {
  const rate = maxSustainableRate(report.windows);
  const fail = report.windows.find(windowFailed);
  const who = pilotLabel(pilot);
  const acc = report.completed ? Math.round(report.correct / report.completed * 100) : 0;
  let headline: string;
  if (!report.windows.length) headline = "No hay medición todavía.";
  else if (rate >= RATE_KEYS[RATE_KEYS.length - 1] && !fail) headline = `${who[0].toUpperCase()}${who.slice(1)} aguantó ${rate} msg/s, el máximo de esta prueba.`;
  else if (fail) headline = breakHeadline(report.broke ?? describeBreak(fail), rate);
  else headline = `Ritmo sostenible de ${who}: ${rate} msg/s.`;
  const cost = pilot === "jev" ? ` Coste estimado ${formatUsd(report.costUsd)}.` : "";
  const errors = report.falseBlocks + report.slipped;
  const Who = `${who[0].toUpperCase()}${who.slice(1)}`;
  const verdict = report.arrived
    ? `${Who}: ${report.correct} aciertos y ${errors} fallo${errors === 1 ? "" : "s"} en ${report.completed} mensajes moderados (${acc}%)${report.dropped ? `; ${report.dropped} se quedaron sin revisar` : ""}.`
    : headline;
  const body = `${report.falseBlocks} mensajes normales bloqueados y ${report.slipped} tóxicos o spam colados. ${headline}${cost}`;
  return { headline: verdict, body, errors: pickErrors(report.errors), rate };
}

export async function sleep(ms: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>(resolve => {
    const id = window.setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, Math.max(8, ms));
    const onAbort = () => { window.clearTimeout(id); resolve(); };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
