"use client";

import { buildSummary, type Pilot, type Report } from "./model";

const WHO: Record<Pilot, { label: string; color: string }> = {
  jev: { label: "Jev", color: "var(--accent-hi)" },
  laya: { label: "Laya", color: "var(--laya)" },
  human: { label: "Persona", color: "var(--warn)" },
};

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs"><span className="text-muted">{label}</span><span className="metric text-ink">{value}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8" aria-hidden="true"><div className={`h-full rounded-full ${tone}`} style={{ width: `${total ? value / total * 100 : 0}%` }} /></div>
    </div>
  );
}

export function RunSummary({ reports, last, running }: { reports: Partial<Record<Pilot, Report>>; last: Pilot | null; running: boolean }) {
  const latest = last ? reports[last] : undefined;
  const summary = latest && last ? buildSummary(latest, last) : null;
  return (
    <div className="space-y-4">
      {summary && !running && (
        <section className="rounded-xl border border-line bg-[#0b0e16] p-5 sm:p-6">
          <p className="text-lg font-semibold leading-snug text-ink">{summary.headline}</p>
          <p className="mt-2 text-sm text-muted">{summary.body}</p>
          {summary.errors.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-ink">
              {summary.errors.map(item => (
                <li key={`${item.kind}-${item.user}-${item.text}`} className="border-l-2 border-white/15 pl-3 text-muted">
                  <span className="metric mr-2 text-[11px] uppercase text-faint">{item.kind === "slipped" ? "Colado" : item.kind === "false_block" ? "Falso bloqueo" : "Sin revisar"}</span>
                  {item.note}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["jev", "laya", "human"] as const).map(pilot => {
          const result = reports[pilot];
          const errors = result ? result.falseBlocks + result.slipped : 0;
          const acc = result?.completed ? Math.round(result.correct / result.completed * 100) : null;
          return (
            <section key={pilot} className="rounded-xl border border-line bg-[#0b0e16] p-4">
              <p className="text-sm font-medium" style={{ color: WHO[pilot].color }}>{WHO[pilot].label}</p>
              {result && result.arrived ? <>
                <p className="mt-2 flex items-baseline gap-3">
                  <span className="metric text-3xl text-ok">{result.correct}</span><span className="text-xs text-muted">aciertos</span>
                  <span className="metric text-3xl text-bad">{errors}</span><span className="text-xs text-muted">fallos</span>
                </p>
                <p className="mt-1 text-[11px] text-faint">{acc === null ? "sin moderar" : `${acc}% de ${result.completed} moderados`} · {result.arrived} llegados</p>
                <div className="mt-4 space-y-2.5">
                  <Bar label="Aciertos" value={result.correct} total={result.arrived} tone="bg-ok" />
                  <Bar label="Normales bloqueados" value={result.falseBlocks} total={result.arrived} tone="bg-warn" />
                  <Bar label="Tóxicos o spam colados" value={result.slipped} total={result.arrived} tone="bg-bad" />
                  <Bar label="Sin revisar a tiempo" value={result.dropped} total={result.arrived} tone="bg-white/35" />
                </div>
              </> : <p className="mt-3 text-sm text-faint">Sin pasada todavía.</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
