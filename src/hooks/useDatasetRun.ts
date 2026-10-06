"use client";

import { useEffect, useRef, useState } from "react";
import type { Bench } from "@/lib/bench/sets";
import type { BenchResult } from "@/lib/bench/server";
import { addHistory } from "@/lib/history";
import { byPilot, PILOT_CONCURRENCY, type ModelPilot } from "@/lib/ai/pilots";

export type Pilot = ModelPilot;
export type RunItem = BenchResult & { wallMs: number };
type Results = Record<Pilot, Record<string, RunItem>>;
const empty = (): Results => byPilot(() => ({}));

export function useDatasetRun(bench: Bench) {
  const [results, setResults] = useState<Results>(empty);
  const [progress, setProgress] = useState<{ pilot: Pilot; done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try { const saved = JSON.parse(localStorage.getItem(`jev-${bench}-v1`) || "null"); setResults(saved && typeof saved === "object" ? { ...empty(), ...saved } : empty()); } catch { setResults(empty()); }
    });
    return () => { cancelAnimationFrame(id); abort.current?.abort(); };
  }, [bench]);

  const cancel = () => abort.current?.abort();
  const run = async (pilot: Pilot, ids: string[]) => {
    cancel();
    const controller = new AbortController(); abort.current = controller;
    setError(""); setProgress({ pilot, done: 0, total: ids.length });
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
        done++; setProgress({ pilot, done, total: ids.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(ids.length, PILOT_CONCURRENCY[pilot]) }, worker));
    if (Object.keys(collected).length) setResults(previous => {
      const next = { ...previous, [pilot]: { ...previous[pilot], ...collected } };
      try { localStorage.setItem(`jev-${bench}-v1`, JSON.stringify(next)); } catch { /* Storage can be unavailable. */ }
      return next;
    });
    if (!controller.signal.aborted && done === ids.length) addHistory({ kind: bench, label: `${bench} / ${pilot}`, detail: `${done} casos etiquetados` });
    if (abort.current === controller) { abort.current = null; setProgress(null); }
  };

  return { results, progress, error, run, cancel };
}
