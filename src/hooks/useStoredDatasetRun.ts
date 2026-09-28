"use client";

import { useEffect, useRef, useState } from "react";
import type { Bench } from "@/lib/bench/sets";
import type { BenchResult } from "@/lib/bench/server";
import { addHistory } from "@/lib/history";

export type Pilot = "jev" | "laya";
export type RunItem = BenchResult & { wallMs: number };
export type Results = Record<Pilot, Record<string, RunItem>>;

export const emptyResults = (): Results => ({ jev: {}, laya: {} });

export function indexFromId(id: string, prefix: string) {
  const n = Number(id.slice(prefix.length)) - 1;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Fixtures written during a visual test: wallMs and latencyMs are exact integers. */
export function isVisualSeed(item: RunItem, index: number, wallBase: number, latencyBase: number) {
  return item.wallMs === wallBase + index && item.ok === true && item.latencyMs === latencyBase + index;
}

export function sanitizeResults(
  results: Results,
  isSeed: (id: string, item: RunItem) => boolean,
  isSyntheticPilot?: (items: Record<string, RunItem>) => boolean,
): Results {
  const next = emptyResults();
  for (const pilot of ["jev", "laya"] as const) {
    for (const [id, item] of Object.entries(results[pilot] ?? {})) {
      if (item && !isSeed(id, item)) next[pilot][id] = item;
    }
    if (isSyntheticPilot?.(next[pilot])) next[pilot] = {};
  }
  return next;
}

function parseStored(
  raw: string | null,
  isSeed: (id: string, item: RunItem) => boolean,
  isSyntheticPilot?: (items: Record<string, RunItem>) => boolean,
): Results | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Results;
    return saved?.jev && saved?.laya ? sanitizeResults(saved, isSeed, isSyntheticPilot) : null;
  } catch {
    return null;
  }
}

export function readResults(
  key: string,
  isSeed: (id: string, item: RunItem) => boolean,
  legacyKey?: string,
  isSyntheticPilot?: (items: Record<string, RunItem>) => boolean,
): Results {
  if (typeof window === "undefined") return emptyResults();
  const current = parseStored(localStorage.getItem(key), isSeed, isSyntheticPilot);
  if (current && (Object.keys(current.jev).length || Object.keys(current.laya).length)) return current;
  if (!legacyKey) return current ?? emptyResults();
  const legacy = parseStored(localStorage.getItem(legacyKey), isSeed, isSyntheticPilot);
  try { localStorage.removeItem(legacyKey); } catch { /* Storage can be unavailable. */ }
  if (!legacy) return current ?? emptyResults();
  try { localStorage.setItem(key, JSON.stringify(legacy)); } catch { /* Storage can be unavailable. */ }
  return legacy;
}

export function useStoredDatasetRun(
  bench: Bench,
  key: string,
  isSeed: (id: string, item: RunItem) => boolean,
  legacyKey?: string,
  isSyntheticPilot?: (items: Record<string, RunItem>) => boolean,
) {
  const [results, setResults] = useState(emptyResults);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<{ pilot: Pilot; done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const skipHydrate = useRef(false);

  const persist = (next: Results) => {
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Storage can be unavailable. */ }
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!skipHydrate.current) {
        let hadStored = false;
        try { hadStored = Boolean(localStorage.getItem(key) || (legacyKey && localStorage.getItem(legacyKey))); } catch { /* Storage can be unavailable. */ }
        const loaded = readResults(key, isSeed, legacyKey, isSyntheticPilot);
        setResults(loaded);
        if (hadStored) {
          try { localStorage.setItem(key, JSON.stringify(loaded)); } catch { /* Storage can be unavailable. */ }
        }
        if (legacyKey) try { localStorage.removeItem(legacyKey); } catch { /* Discard seeded v1. */ }
      }
      setReady(true);
    });
    return () => {
      cancelAnimationFrame(id);
      abort.current?.abort();
    };
  }, [bench, key, legacyKey, isSeed, isSyntheticPilot]);

  const cancel = () => abort.current?.abort();

  const run = async (pilot: Pilot, ids: string[]) => {
    skipHydrate.current = true;
    cancel();
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setProgress({ pilot, done: 0, total: ids.length });
    setResults(previous => {
      const next = { ...previous, [pilot]: {} };
      persist(next);
      return next;
    });
    const collected: Record<string, RunItem> = {};
    let cursor = 0, done = 0;
    const worker = async () => {
      while (cursor < ids.length && !controller.signal.aborted) {
        const itemId = ids[cursor++];
        const start = performance.now();
        try {
          const response = await fetch(`/api/decide/${bench}/${pilot}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId }), signal: controller.signal });
          const result = await response.json() as BenchResult;
          if (controller.signal.aborted) return;
          collected[itemId] = { ...result, wallMs: performance.now() - start };
          if (!result.ok) setError(result.error);
        } catch (cause) {
          if (controller.signal.aborted) return;
          collected[itemId] = { ok: false, code: "upstream", error: cause instanceof Error ? cause.message : "La petición falló.", wallMs: performance.now() - start };
          setError(collected[itemId].error);
        }
        done++;
        setProgress({ pilot, done, total: ids.length });
        setResults(previous => {
          const next = { ...previous, [pilot]: { ...previous[pilot], ...collected } };
          persist(next);
          return next;
        });
      }
    };
    await Promise.all(Array.from({ length: Math.min(ids.length, pilot === "laya" ? 1 : 4) }, worker));
    if (!controller.signal.aborted && done === ids.length) addHistory({ kind: bench, label: `${bench} / ${pilot}`, detail: `${done} casos etiquetados` });
    if (abort.current === controller) { abort.current = null; setProgress(null); }
  };

  return { results, progress, error, run, cancel, ready };
}
