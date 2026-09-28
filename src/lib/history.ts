export type HistoryEntry = { id: string; kind: "flappy" | "tetris" | "strawberry" | "bandeja" | "cascada" | "guardia" | "chat" | "carretera"; label: string; detail: string; at: string };
const KEY = "jev-benchmark-history-v1";

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try { const value = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value.slice(0, 50) : []; }
  catch { return []; }
}

export function addHistory(entry: Omit<HistoryEntry, "id" | "at">) {
  if (typeof window === "undefined") return;
  const item = { ...entry, id: crypto.randomUUID(), at: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify([item, ...readHistory()].slice(0, 50)));
}
