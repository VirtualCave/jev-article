"use client";

import { useEffect, useState } from "react";
import type { MoveTrace, SpendMeter } from "../../lib/ai/compose";
import { formatMs, formatUsd } from "../../lib/ai/pricing";
import type { PlayerKind, WellStatus } from "../../lib/tetris/types";

export function MoveMeter({
  trace,
  status,
  player,
  spend,
}: {
  trace: MoveTrace | null;
  status: WellStatus;
  player: PlayerKind;
  spend: SpendMeter;
}) {
  const thinking = status === "thinking";
  const elapsed = useElapsed(thinking && player !== "human");
  if (player === "human") return null;
  const missing = "n/d";
  const decide =
    thinking ? formatMs(elapsed) : trace?.decideMs != null ? formatMs(trace.decideMs) : missing;
  const latency = thinking
    ? "…"
    : trace?.latencyMs != null
      ? formatMs(trace.latencyMs)
      : missing;
  const cost =
    player === "laya"
      ? "local"
      : thinking
        ? "…"
        : trace?.usage?.costUsd != null
          ? `${formatUsd(trace.usage.costUsd)}${trace.usage.input_tokens != null ? ` · ${trace.usage.input_tokens} tok` : ""}`
          : missing;
  const matchCost =
    player !== "laya"
      ? spend.calls > 0
        ? `${formatUsd(spend.costUsd)}${spend.inputTokens > 0 ? ` · ${spend.inputTokens} tok` : ""}`
        : missing
      : null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px] tabular-nums sm:grid-cols-4">
      <Meter label="Toma de decision" value={decide} />
      <Meter label="Latencia" value={latency} />
      <Meter label="Coste API" value={cost} />
      {matchCost != null && <Meter label="Coste partida" value={matchCost} />}
    </dl>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className="mt-1 text-ink">{value}</dd>
    </div>
  );
}

export function DecisionStrip({
  trace,
  status,
  notice,
}: {
  trace: MoveTrace | null;
  status: WellStatus;
  notice: string | null;
}) {
  const thinking = status === "thinking";
  const line = thinking
    ? "Leyendo el pozo y eligiendo una caida."
    : trace
      ? trace.note
      : "Esperando la primera pieza.";

  return (
    <div className="min-h-[4.5rem] border-t border-line pt-3">
      <p className="font-mono text-[11px] text-muted">
        {thinking ? "En curso" : trace ? fuente(trace.source) : "Sin jugada"}
        {trace?.model ? `  ${trace.model}` : ""}
        {trace?.confidence != null ? `  ${trace.confidence.toFixed(2)}` : ""}
      </p>
      <p className={`mt-1 text-sm leading-snug text-ink ${thinking ? "motion-safe:animate-pulse" : ""}`}>
        {line}
      </p>
      {notice && <p className="mt-2 text-sm text-ink/80">{notice}</p>}
    </div>
  );
}

function fuente(source: MoveTrace["source"]) {
  if (source === "model") return "Modelo";
  if (source === "policy") return "Codigo";
  return "Lista corta";
}

function useElapsed(active: boolean) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) {
      return;
    }
    const started = performance.now();
    const tick = () => setMs(performance.now() - started);
    const id = window.setInterval(tick, 80);
    return () => window.clearInterval(id);
  }, [active]);
  return ms;
}
