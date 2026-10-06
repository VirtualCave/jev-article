"use client";

import { useMemo } from "react";
import { indexFromId, isVisualSeed, useStoredDatasetRun, type RunItem } from "@/hooks/useStoredDatasetRun";
import { prediction } from "@/lib/bench/answers";
import { accuracy, cascade, type CascadeItem, type Prediction } from "@/lib/bench/metrics";
import type { BenchResult } from "@/lib/bench/server";
import { tickets, type Ticket } from "@/lib/data/tickets";
import { PILOT_LABEL, type ModelPilot } from "@/lib/ai/pilots";

/** Pilots that can sit in front of Jev. Every ticket goes through this first stage. */
export type FirstPilot = Exclude<ModelPilot, "jev">;
export const FIRST_PILOTS: FirstPilot[] = ["laya", "clef-flash", "clef"];
export type Station = "first" | "jev" | "human";

export const DEPT_LABEL: Record<string, string> = {
  billing: "Facturación",
  technical: "Técnico",
  account: "Cuenta",
};

const SIGNALS: Record<Ticket["department"], RegExp> = {
  billing: /invoice|billed|charg|refund|payment|price|tax|coupon|receipt|billing|fee|payroll|seat/i,
  technical: /api|bug|crash|timeout|dashboard|webhook|deploy|sso|import|outage|sync|endpoint|sandbox|status page|freeze|callback/i,
  account: /password|two-factor|2fa|access|admin|workspace|invite|role|locked|ownership|session|permission|account|member/i,
};

export type CascadaTicket = {
  ticket: Ticket;
  first: Prediction;
  jev?: Prediction;
  firstMs: number;
  jevMs?: number;
  firstCostUsd: number;
  jevCostUsd?: number;
  station: Station;
  firstCorrect: boolean;
  jevCorrect: boolean | null;
  finalCorrect: boolean;
  why: string;
  mix: string | null;
};

export type StationStats = {
  station: Station;
  n: number;
  correct: number;
  accuracy: number;
  costUsd: number;
  timeMs: number;
};

function itemPrediction(result: BenchResult | undefined, key: string, truth: Prediction["truth"]): Prediction | null {
  if (!result?.ok) return null;
  const answer = prediction(result.answers[key]);
  return answer ? { predicted: answer.value, truth, confidence: answer.confidence } : null;
}

function mixReason(ticket: Ticket, predicted: string | number | boolean) {
  if (predicted === ticket.department) return null;
  const key = String(predicted);
  if (key !== "billing" && key !== "technical" && key !== "account") {
    return `el modelo eligió ${key} con seguridad, pero la etiqueta real es ${DEPT_LABEL[ticket.department]}`;
  }
  const hit = ticket.text.match(SIGNALS[key]);
  if (hit) return `el texto menciona «${hit[0]}», una pista típica de ${DEPT_LABEL[key]}, aunque el departamento real es ${DEPT_LABEL[ticket.department]}`;
  return `el modelo se mostró seguro de ${DEPT_LABEL[key]} sin que el texto apunte con claridad a ese departamento`;
}

function whyText(item: Omit<CascadaTicket, "why" | "mix" | "finalCorrect" | "station">, station: Station, thresholdA: number, thresholdB: number, label: string) {
  const a = Math.round(thresholdA * 100);
  const b = Math.round(thresholdB * 100);
  const firstPct = Math.round(item.first.confidence * 100);
  const firstDept = DEPT_LABEL[String(item.first.predicted)] ?? String(item.first.predicted);
  if (station === "first") {
    const verdict = item.firstCorrect ? "Acertó." : `Falló: predijo ${firstDept} y era ${DEPT_LABEL[item.ticket.department]}.`;
    return `${label} asignó ${firstDept} con ${firstPct}% de confianza, por encima del umbral A (${a}%). El ticket se queda aquí y no se consulta a Jev. ${verdict}`;
  }
  const jevPct = item.jev ? Math.round(item.jev.confidence * 100) : null;
  const jevDept = item.jev ? DEPT_LABEL[String(item.jev.predicted)] ?? String(item.jev.predicted) : null;
  if (station === "jev" && item.jev && jevDept !== null && jevPct !== null) {
    const verdict = item.jevCorrect ? "Jev acertó." : `Jev falló: predijo ${jevDept} y era ${DEPT_LABEL[item.ticket.department]}.`;
    return `${label} solo tenía ${firstPct}% (umbral A ${a}%), así que el ticket viaja a Jev. Jev asignó ${jevDept} con ${jevPct}% ≥ B (${b}%). ${verdict}`;
  }
  if (!item.jev) {
    return `${label} tenía ${firstPct}%, por debajo de A (${a}%), y no hay respuesta de Jev en la pasada de Bandeja. El ticket va a revisión humana.`;
  }
  return `Ni ${label} (${firstPct}% < A ${a}%) ni Jev (${jevPct}% < B ${b}%) superaron su umbral. Una persona revisa el departamento; esa revisión se estima perfecta.`;
}

function route(first: Prediction, jev: Prediction | undefined, thresholdA: number, thresholdB: number): Station {
  if (first.confidence >= thresholdA) return "first";
  if (jev && jev.confidence >= thresholdB) return "jev";
  return "human";
}

function statsFor(items: CascadaTicket[], station: Station): StationStats {
  const rows = items.filter(item => item.station === station);
  const correct = station === "human" ? rows.length : rows.filter(row => row.finalCorrect).length;
  const costUsd = station === "first" ? rows.reduce((sum, row) => sum + row.firstCostUsd, 0) : station === "jev" ? rows.reduce((sum, row) => sum + (row.jevCostUsd ?? 0), 0) : 0;
  const timeMs = station === "first"
    ? rows.reduce((sum, row) => sum + row.firstMs, 0)
    : station === "jev"
      ? rows.reduce((sum, row) => sum + (row.jevMs ?? 0), 0)
      : 0;
  return { station, n: rows.length, correct, accuracy: rows.length ? correct / rows.length : 0, costUsd, timeMs };
}

export function stationStats(items: CascadaTicket[]) {
  return { first: statsFor(items, "first"), jev: statsFor(items, "jev"), human: statsFor(items, "human") };
}

export function isBandejaSeed(id: string, item: RunItem) {
  const n = indexFromId(id, "ticket-");
  return n !== null && isVisualSeed(item, n, 120, 80);
}

/** Same detector Bandeja uses: fixed 150 ms, one wall for every ticket, or urgency=1 + churn=0.2. */
export function isBandejaSyntheticPilot(items: Record<string, RunItem>) {
  const rows = Object.values(items).filter(row => row.ok);
  if (rows.length < 8) return false;
  if (rows.every(row => Math.round(row.wallMs) === 150)) return true;
  if (new Set(rows.map(row => Math.round(row.wallMs))).size === 1) return true;
  const urgencies = rows.map(row => row.answers.urgency);
  const churns = rows.map(row => row.answers.churn);
  return Boolean(
    urgencies.length
    && urgencies.every(answer => answer?.type === "score" && answer.score === 1)
    && churns.every(answer => answer?.type === "noul" && answer.noul === 0.2),
  );
}

export function useCascadaRun(first: FirstPilot, thresholdA: number, thresholdB: number) {
  // Live Bandeja key is jev-bandeja-v2; v1 is discarded as the visual-test seed store.
  const dataset = useStoredDatasetRun("bandeja", "jev-bandeja-v2", isBandejaSeed, "jev-bandeja-v1", isBandejaSyntheticPilot);
  const { results } = dataset;

  const derived = useMemo(() => {
    const label = PILOT_LABEL[first];
    const items: CascadaTicket[] = [];
    const samples: CascadeItem[] = [];
    for (const ticket of tickets) {
      const firstResult = results[first][ticket.id];
      const jevResult = results.jev[ticket.id];
      if (!firstResult?.ok) continue;
      const head = itemPrediction(firstResult, "department", ticket.department);
      if (!head) continue;
      const jev = jevResult?.ok ? itemPrediction(jevResult, "department", ticket.department) ?? undefined : undefined;
      const sample: CascadeItem = { first: head, jev, firstMs: firstResult.latencyMs, jevMs: jevResult?.ok ? jevResult.latencyMs : undefined, firstCostUsd: firstResult.usage.costUsd, jevCostUsd: jevResult?.ok ? jevResult.usage.costUsd : undefined };
      samples.push(sample);
      const station = route(head, jev, thresholdA, thresholdB);
      const firstCorrect = head.predicted === head.truth;
      const jevCorrect = jev ? jev.predicted === jev.truth : null;
      const decided = station === "first" ? head : station === "jev" ? jev : undefined;
      const base = { ticket, first: head, jev, firstMs: sample.firstMs, jevMs: sample.jevMs, firstCostUsd: firstResult.usage.costUsd, jevCostUsd: sample.jevCostUsd, firstCorrect, jevCorrect };
      items.push({
        ...base,
        station,
        finalCorrect: station === "human" ? true : decided?.predicted === decided?.truth,
        mix: decided ? mixReason(ticket, decided.predicted) : null,
        why: whyText(base, station, thresholdA, thresholdB, label),
      });
    }
    const summary = cascade(samples, thresholdA, thresholdB);
    const jevRows = tickets.map(item => results.jev[item.id]).filter((result): result is RunItem & { ok: true } => Boolean(result?.ok));
    const baseline = tickets.flatMap(item => {
      const row = itemPrediction(results.jev[item.id], "department", item.department);
      return row ? [row] : [];
    });
    const missingJev = samples.filter(item => item.first.confidence < thresholdA && !item.jev).length;
    const failures = items.filter(item => item.station !== "human" && !item.finalCorrect);
    const firstReady = tickets.filter(item => itemPrediction(results[first][item.id], "department", item.department)).length;
    const jevReady = tickets.filter(item => itemPrediction(results.jev[item.id], "department", item.department)).length;
    return {
      items,
      samples,
      summary,
      stations: stationStats(items),
      jevRows,
      baselineAccuracy: baseline.length ? accuracy(baseline) : null,
      jevOnlyCost: jevRows.reduce((sum, row) => sum + row.usage.costUsd, 0),
      jevOnlyLatency: jevRows.length ? jevRows.reduce((sum, row) => sum + row.latencyMs, 0) / jevRows.length : null,
      missingJev,
      failures,
      firstReady,
      jevReady,
    };
  }, [first, results, thresholdA, thresholdB]);

  return { ...dataset, ...derived, ids: tickets.map(item => item.id) };
}
