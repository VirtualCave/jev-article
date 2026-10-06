"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BenchResult } from "@/lib/bench/server";
import { addHistory } from "@/lib/history";
import { byPilot, MODEL_PILOTS, PILOT_CONCURRENCY, type ModelPilot } from "@/lib/ai/pilots";

export type Pilot = ModelPilot;
export type RunItem = BenchResult & { wallMs: number };
type Results = Record<Pilot, Record<string, RunItem>>;
const empty = (): Results => byPilot(() => ({}));
const keyFor = (bench: string) => `jev-${bench}-v2`;
const legacyKey = (bench: string) => `jev-${bench}-v1`;
const subscribeNone = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;

function isRunItem(value: unknown): value is RunItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.wallMs !== "number" || !Number.isFinite(row.wallMs)) return false;
  if (row.ok === false) return typeof row.error === "string";
  if (row.ok !== true || !row.answers || typeof row.answers !== "object") return false;
  return true;
}

/** Drops the visual-test seed (fixed 150 ms, urgency=1, noul=0.2 for every ticket). */
function isSynthetic(items: Record<string, RunItem>) {
  const rows = Object.values(items).filter(row => row.ok);
  if (rows.length < 8) return false;
  if (rows.every(row => Math.round(row.wallMs) === 150)) return true;
  const walls = new Set(rows.map(row => Math.round(row.wallMs)));
  if (walls.size === 1) return true;
  const urgencies = rows.map(row => row.answers.urgency);
  const churns = rows.map(row => row.answers.churn);
  if (
    urgencies.length
    && urgencies.every(answer => answer?.type === "score" && answer.score === 1)
    && churns.every(answer => answer?.type === "noul" && answer.noul === 0.2)
  ) return true;
  return false;
}

function readStored(bench: string): Results {
  try { localStorage.removeItem(legacyKey(bench)); } catch { /* ignore */ }
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(bench)) || "null") as Partial<Results> | null;
    if (!saved || typeof saved !== "object") return empty();
    const next = empty();
    for (const pilot of MODEL_PILOTS) {
      const bag = saved[pilot];
      if (!bag || typeof bag !== "object") continue;
      for (const [id, row] of Object.entries(bag)) if (isRunItem(row)) next[pilot][id] = row;
      if (isSynthetic(next[pilot])) next[pilot] = {};
    }
    return next;
  } catch {
    return empty();
  }
}

/** Like useDatasetRun, but streams each case into state so the inbox can fill live. */
export function useBandejaRun(bench: "bandeja") {
  const mounted = useSyncExternalStore(subscribeNone, clientMounted, serverMounted);
  const [results, setResults] = useState<Results | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ pilot: Pilot; done: number; total: number } | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [arrived, setArrived] = useState<string[]>([]);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const pendingRef = useRef(new Set<string>());

  if (mounted && source !== bench) {
    setResults(readStored(bench));
    setSource(bench);
  }

  useEffect(() => () => { abort.current?.abort(); }, [bench]);

  const cancel = () => abort.current?.abort();
  const current = results ?? empty();
  const persist = (next: Results) => {
    try { localStorage.setItem(keyFor(bench), JSON.stringify(next)); } catch { /* Storage can be unavailable. */ }
  };

  const run = async (pilot: Pilot, ids: string[]) => {
    cancel();
    const controller = new AbortController();
    abort.current = controller;
    pendingRef.current = new Set();
    setPending([]);
    setArrived([]);
    setError("");
    setProgress({ pilot, done: 0, total: ids.length });
    setResults(previous => {
      const next = { ...(previous ?? empty()), [pilot]: {} };
      persist(next);
      return next;
    });
    const collected: Record<string, RunItem> = {};
    let cursor = 0, done = 0;

    const worker = async () => {
      while (cursor < ids.length && !controller.signal.aborted) {
        const itemId = ids[cursor++];
        pendingRef.current.add(itemId);
        setPending([...pendingRef.current]);
        const start = performance.now();
        try {
          const response = await fetch(`/api/decide/${bench}/${pilot}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ itemId }),
            signal: controller.signal,
            cache: "no-store",
          });
          const result = await response.json() as BenchResult;
          if (controller.signal.aborted) return;
          collected[itemId] = { ...result, wallMs: performance.now() - start };
          if (!result.ok) setError(result.error);
        } catch (cause) {
          if (controller.signal.aborted) return;
          collected[itemId] = { ok: false, code: "upstream", error: cause instanceof Error ? cause.message : "La petición falló.", wallMs: performance.now() - start };
          setError(collected[itemId].error);
        }
        pendingRef.current.delete(itemId);
        setPending([...pendingRef.current]);
        done++;
        setProgress({ pilot, done, total: ids.length });
        setArrived(previous => previous.includes(itemId) ? previous : [...previous, itemId]);
        setResults(previous => {
          const next = { ...(previous ?? empty()), [pilot]: { ...collected } };
          persist(next);
          return next;
        });
      }
    };

    await Promise.all(Array.from({ length: Math.min(ids.length, PILOT_CONCURRENCY[pilot]) }, worker));
    if (!controller.signal.aborted && done === ids.length) addHistory({ kind: bench, label: `${bench} / ${pilot}`, detail: `${done} casos etiquetados` });
    if (abort.current === controller) {
      abort.current = null;
      pendingRef.current = new Set();
      setPending([]);
      setProgress(null);
    }
  };

  return { results: current, progress, pending, arrived, error, ready: results !== null, run, cancel };
}
