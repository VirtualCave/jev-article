"use client";

import { cascade } from "@/lib/bench/metrics";
import { formatMs, formatUsd } from "@/lib/ai/pricing";
import { DEPT_LABEL, type CascadaTicket, type FirstPilot } from "@/hooks/useCascadaRun";
import { PILOT_COLOR, PILOT_LABEL } from "@/lib/ai/pilots";

type Summary = ReturnType<typeof cascade>;

function pct(value: number, ready: boolean) {
  return ready ? `${Math.round(value * 100)}%` : "—";
}

function share(count: number, n: number) {
  return n ? `${count} (${Math.round(count / n * 100)}%)` : "—";
}

function Value({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="panel min-w-0 overflow-hidden p-5">
      <p className="text-xs wrap-break-word text-muted">{label}</p>
      <p className="metric mt-2 text-2xl">{value}</p>
      {note && <p className="mt-1 text-xs wrap-break-word text-muted">{note}</p>}
    </div>
  );
}

function sentence(text: string) {
  const cut = text.split(/(?<=\.)\s/)[0] ?? text;
  return cut.length > 140 ? `${cut.slice(0, 137).trim()}…` : cut;
}

function Example({ item, label, onSelect }: { item: CascadaTicket; label: string; onSelect: (id: string) => void }) {
  const n = item.ticket.id.replace("ticket-", "");
  const who = item.station === "first" ? label : item.station === "jev" ? "Jev" : "Humano";
  const pred = item.station === "first" ? item.first.predicted : item.jev?.predicted;
  const conf = item.station === "first" ? item.first.confidence : item.jev?.confidence ?? 0;
  return (
    <button type="button" onClick={() => onSelect(item.ticket.id)} className="w-full min-w-0 rounded-md border border-line bg-white/3 px-3 py-2.5 text-left hover:border-white/25">
      <p className="text-[11px] text-muted">{n} · {who} · {DEPT_LABEL[String(pred)] ?? (pred == null ? "revisión" : String(pred))} {Math.round(conf * 100)}% · era {DEPT_LABEL[item.ticket.department]}</p>
      <p className="mt-1 truncate text-sm">{item.ticket.text}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{sentence(item.mix && item.station !== "human" && !item.finalCorrect ? `${item.why} ${item.mix.charAt(0).toUpperCase()}${item.mix.slice(1)}.` : item.why)}</p>
    </button>
  );
}

function Card({ title, label, items, empty, onSelect }: { title: string; label: string; items: CascadaTicket[]; empty: string; onSelect: (id: string) => void }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white/3 p-4">
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="mt-1 text-xs text-muted">{items.length ? `${items.length} ejemplo${items.length === 1 ? "" : "s"}` : empty}</p>
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map(item => <li key={item.ticket.id}><Example item={item} label={label} onSelect={onSelect} /></li>)}
        </ul>
      )}
    </div>
  );
}

export function CascadeReport({
  first,
  items,
  summary,
  failures,
  jevRows,
  jevOnlyCost,
  jevOnlyLatency,
  baselineAccuracy,
  onSelect,
}: {
  first: FirstPilot;
  items: CascadaTicket[];
  summary: Summary;
  failures: CascadaTicket[];
  jevRows: { usage: { costUsd: number }; latencyMs: number }[];
  jevOnlyCost: number;
  jevOnlyLatency: number | null;
  baselineAccuracy: number | null;
  onSelect: (id: string) => void;
}) {
  const label = PILOT_LABEL[first];
  const n = items.length;
  const saved = n - summary.human;
  const wins = items.filter(item => item.station !== "human" && item.finalCorrect).slice(0, 5);
  const misses = failures.slice(0, 5);
  const headline = n
    ? `${saved} de ${n} se resuelven en automático (${n ? Math.round(saved / n * 100) : 0}%). ${failures.length ? `${failures.length} ${failures.length === 1 ? "falló" : "fallaron"} con alta confianza.` : "Ningún fallo de alta confianza."}`
    : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Value label={`Resueltos por ${label}`} value={share(summary.first, n)} />
        <Value label="Resueltos por Jev" value={share(summary.jev, n)} />
        <Value label="A revisión humana" value={share(summary.human, n)} />
        <Value label="Acierto automatizado" value={summary.automated ? pct(summary.automatedAccuracy, true) : "—"} note={n ? `Acierto final estimado ${pct(summary.estimatedFinalAccuracy, true)} si la persona no falla` : undefined} />
      </div>
      <section className="panel min-w-0 overflow-hidden p-6">
        <h3 className="text-xl font-semibold">Coste y latencia por estrategia</h3>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="eyebrow">Cascada / {n || "—"} tickets</p>
            <p className="metric mt-3 text-xl wrap-break-word">{n ? formatUsd(summary.costUsd) : "—"} · {n ? formatMs(summary.meanModelLatencyMs) : "—"} / ticket</p>
            <p className="mt-2 text-xs text-muted">Acierto final estimado {n ? pct(summary.estimatedFinalAccuracy, true) : "—"} si la revisión humana es perfecta. Tiempo y coste humano no incluidos. Cuenta lo que cobra el primer escalón en todos los tickets y lo de Jev en los que le llegan, también si luego van a una persona.</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Todo Jev / {jevRows.length || "—"} tickets</p>
            <p className="metric mt-3 text-xl wrap-break-word">{jevRows.length ? formatUsd(jevOnlyCost) : "—"} · {jevOnlyLatency !== null ? formatMs(jevOnlyLatency) : "—"} / ticket</p>
            <p className="mt-2 text-xs text-muted">Acierto de departamento {baselineAccuracy !== null ? pct(baselineAccuracy, true) : "—"}. Sale de la misma pasada; no se vuelve a pagar al mover los umbrales.</p>
          </div>
        </div>
      </section>
      {headline && (
        <section className="panel min-w-0 overflow-hidden p-6">
          <h3 className="text-xl font-semibold">Qué ha pasado</h3>
          <p className="mt-2 text-sm text-muted">{headline}</p>
          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card title={`Resuelto bien en ${label}/Jev`} label={label} items={wins} empty="Ningún ticket se quedó en automático con acierto." onSelect={onSelect} />
            <Card title="Falló con alta confianza" label={label} items={misses} empty="En este umbral no hay fallos de alta confianza." onSelect={onSelect} />
          </div>
        </section>
      )}
    </div>
  );
}

type Strategy = { key: string; label: string; hint: string; correct: number; wrong: number; human: number; n: number; costUsd: number | null; ms: number | null; color: string };

export function CascadeVerdict({ first, items, summary, thresholdA, thresholdB }: { first: FirstPilot; items: CascadaTicket[]; summary: Summary; thresholdA: number; thresholdB: number }) {
  const label = PILOT_LABEL[first];
  const n = items.length;
  if (!n) return null;
  const withJev = items.filter(item => item.jev);
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const jevCalls = items.filter(item => item.first.confidence < thresholdA && item.jev).length;
  const rows: Strategy[] = [
    { key: "first", label: `Solo ${label}`, hint: `${label} decide los ${n}`, correct: items.filter(item => item.firstCorrect).length, wrong: items.filter(item => !item.firstCorrect).length, human: 0, n, costUsd: items.reduce((sum, item) => sum + item.firstCostUsd, 0), ms: mean(items.map(item => item.firstMs)), color: PILOT_COLOR[first] },
    { key: "jev", label: "Solo Jev", hint: withJev.length === n ? "Jev decide los 60" : `Jev en ${withJev.length} tickets`, correct: withJev.filter(item => item.jevCorrect).length, wrong: withJev.filter(item => item.jevCorrect === false).length, human: 0, n: withJev.length, costUsd: withJev.length ? withJev.reduce((sum, item) => sum + (item.jevCostUsd ?? 0), 0) : null, ms: mean(withJev.map(item => item.jevMs ?? 0)), color: "var(--accent-hi)" },
    { key: "cascade", label: "Cascada", hint: `Jev en ${jevCalls} · persona en ${summary.human}`, correct: items.filter(item => item.station !== "human" && item.finalCorrect).length, wrong: items.filter(item => item.station !== "human" && !item.finalCorrect).length, human: summary.human, n, costUsd: summary.costUsd, ms: summary.meanModelLatencyMs, color: "var(--ok)" },
  ];
  const [, jev, cascadeRow] = rows;
  const saving = jev.costUsd ? 1 - (cascadeRow.costUsd ?? 0) / jev.costUsd : null;
  const verdict = !withJev.length
    ? `Falta la pasada de Jev: la comparación solo tiene a ${label}.`
    : cascadeRow.wrong <= jev.wrong
      ? `Compensa: con A ${Math.round(thresholdA * 100)}% y B ${Math.round(thresholdB * 100)}% la cascada comete ${cascadeRow.wrong} error${cascadeRow.wrong === 1 ? "" : "es"}, no más que Jev solo (${jev.wrong}), y llama a Jev en ${jevCalls} de ${n} tickets${saving !== null ? `: ${Math.round(saving * 100)}% menos coste de Jev` : ""}.`
      : `Ahorra ${saving !== null ? `${Math.round(saving * 100)}% del coste de Jev` : "llamadas a Jev"} a cambio de ${cascadeRow.wrong - jev.wrong} error${cascadeRow.wrong - jev.wrong === 1 ? "" : "es"} más que Jev solo (${cascadeRow.wrong} frente a ${jev.wrong}). ${cascadeRow.wrong > 0 && items.some(item => item.station === "first" && !item.firstCorrect) ? `Los errores extra son de ${label} con confianza alta: sube A para mandar más tickets a Jev.` : "Sube B para mandar a una persona los casos dudosos de Jev."}`;
  const most = Math.max(...rows.map(row => row.n), 1);
  return (
    <section className="panel min-w-0 overflow-hidden p-5 sm:p-6" aria-labelledby="cascade-verdict">
      <p className="eyebrow">Veredicto</p>
      <h3 id="cascade-verdict" className="mt-1 text-lg font-semibold leading-snug">{verdict}</h3>
      <div className="mt-5 space-y-4">
        {rows.map(row => (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[9rem_1fr_13rem] sm:items-center sm:gap-4">
            <div><p className="text-sm font-medium" style={{ color: row.color }}>{row.label}</p><p className="text-[11px] text-faint">{row.hint}</p></div>
            <div className="flex h-7 overflow-hidden rounded-md bg-white/6" role="img" aria-label={`${row.label}: ${row.correct} aciertos, ${row.wrong} errores, ${row.human} a persona`}>
              <div className="flex items-center justify-end bg-ok/70 px-2 text-[11px] font-semibold text-[#07130d]" style={{ width: `${row.correct / most * 100}%` }}>{row.correct}</div>
              {row.wrong > 0 && <div className="flex items-center justify-center bg-bad/80 text-[11px] font-semibold text-white" style={{ width: `${Math.max(4, row.wrong / most * 100)}%` }}>{row.wrong}</div>}
              {row.human > 0 && <div className="flex items-center justify-center bg-warn/70 text-[11px] font-semibold text-[#1a1204]" style={{ width: `${Math.max(4, row.human / most * 100)}%` }}>{row.human}</div>}
            </div>
            <p className="metric text-xs text-muted sm:text-right">{row.costUsd === null ? "—" : formatUsd(row.costUsd)} · {row.ms === null ? "—" : formatMs(row.ms)} / ticket</p>
          </div>
        ))}
      </div>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-ok/70" />aciertos de departamento</span>
        <span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-bad/80" />errores que llegan al cliente</span>
        <span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-warn/70" />enviados a una persona</span>
        <span>Coste: lo que cobran los modelos en los {n} tickets. Tiempo: modelos, sin la revisión humana.</span>
      </p>
    </section>
  );
}
