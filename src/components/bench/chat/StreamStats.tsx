"use client";

import { formatMs } from "@/lib/ai/pricing";
import type { LiveStats } from "./model";

function Spark({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const width = Math.max(2, values.length);
  const points = values.map((value, index) => `${index},${36 - (value / max) * 32}`).join(" ");
  return (
    <svg className="mt-2 h-14 w-full" viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" role="img" aria-label={label}>
      {values.length > 1 && <polyline fill="none" stroke="#e0336f" strokeWidth="1.4" points={points} />}
    </svg>
  );
}

function Cell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-faint">{label}</p>
      <p className="metric mt-1 truncate text-2xl text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function StreamStats({ live, running, who }: { live: LiveStats; running: boolean; who: string }) {
  const acc = live.completed ? Math.round(live.correct / live.completed * 100) : 0;
  return (
    <section className="flex h-[min(480px,calc(100dvh-16.5rem))] min-h-0 flex-col overflow-y-auto overflow-anchor-none rounded-xl border border-line bg-[#0b0e16] p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{running ? `Modera ${who}` : who ? `Última pasada: ${who}` : "Esperando un piloto"}</p>
          <p className="metric mt-2 text-4xl tracking-tight sm:text-5xl">{live.rate ? live.rate.toFixed(live.rate >= 10 ? 0 : 1) : "0"}<span className="ml-2 text-lg text-faint">msg/s</span></p>
          <p className="mt-1 text-[11px] text-faint">real, últimos 4 s{live.targetRate ? ` · objetivo ${live.targetRate.toFixed(live.targetRate >= 10 ? 0 : 1)}` : ""}{live.elapsedMs > 0 ? ` · ${(live.elapsedMs / 1000).toFixed(1)} s` : ""}</p>
        </div>
        {running && <span className="mb-1 inline-flex items-center gap-1.5 rounded-sm bg-bad px-2 py-1 text-[10px] font-bold tracking-wide text-white">LIVE</span>}
      </div>
      {live.broke && <p className="mt-3 text-xs font-medium leading-snug text-bad">Aquí se rompió: {live.broke.rate} msg/s porque {live.broke.detail}.</p>}
      {live.saturated && running && <p className="mt-2 text-xs text-warn">Saturado (cola &gt; 50 o p95 &gt; 5 s). Las llegadas siguen; el exceso se pierde.</p>}
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4">
        <Cell label="Llegados" value={`${live.arrived}`} />
        <Cell label="Moderados" value={`${live.completed}`} />
        <Cell label="Cola" value={`${live.pending}`} />
        <Cell label="p95 en vivo" value={formatMs(live.p95Ms)} hint="ventana de 4 s" />
        <Cell label="Aciertos" value={`${live.correct}`} hint={live.completed ? `${acc}%` : "sin decidir"} />
        <Cell label="Perdidos" value={`${live.dropped}`} />
        <Cell label="Falsos bloqueos" value={`${live.falseBlocks}`} />
        <Cell label="Tóxicos colados" value={`${live.slipped}`} />
      </div>
      <div className="mt-auto pt-6">
        <p className="text-[11px] text-faint">Latencia p95</p>
        {live.p95Trail.length > 1 ? <Spark values={live.p95Trail} label="Sparkline de latencia p95" /> : <p className="mt-3 text-sm text-faint">La curva aparece en cuanto hay decisiones.</p>}
      </div>
    </section>
  );
}
