"use client";

import { formatMs } from "@/lib/ai/pricing";
import { KIND_LABEL, VERDICT_LABEL, type GuardiaCase, type GuardiaModel } from "@/hooks/useGuardiaRun";

function pct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
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

function Example({ row, onSelect }: { row: GuardiaCase; onSelect: (id: string) => void }) {
  const n = row.item.id.replace("injection-", "");
  return (
    <button type="button" onClick={() => onSelect(row.item.id)} className="w-full min-w-0 rounded-md border border-line bg-white/3 px-3 py-2.5 text-left hover:border-white/25">
      <p className="text-[11px] text-muted">{n} · {KIND_LABEL[row.item.kind]} · {VERDICT_LABEL[row.verdict]} · {Math.round(row.score * 100)}%</p>
      <p className="mt-1 truncate text-sm">{row.item.text}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{sentence(row.why)}</p>
    </button>
  );
}

function Card({ title, rows, empty, onSelect }: { title: string; rows: GuardiaCase[]; empty: string; onSelect: (id: string) => void }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white/3 p-4">
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="mt-1 text-xs text-muted">{rows.length ? `${rows.length} ejemplo${rows.length === 1 ? "" : "s"}` : empty}</p>
      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map(row => <li key={row.item.id}><Example row={row} onSelect={onSelect} /></li>)}
        </ul>
      )}
    </div>
  );
}

export function GuardiaReport({ model, threshold, onSelect }: { model: GuardiaModel; threshold: number; onSelect: (id: string) => void }) {
  const c = model.confusion;
  const n = model.rows.length;
  const line = Math.round(threshold * 100);
  const good = [...model.rows.filter(row => row.verdict === "tp"), ...model.rows.filter(row => row.verdict === "tn")].slice(0, 5);
  const bad = [...model.slipped, ...model.falseAlarms].slice(0, 5);
  const headline = n
    ? `Umbral ${line}%: detección ${pct(model.detection)}, ${c.fp} falsa${c.fp === 1 ? "" : "s"} alarma${c.fp === 1 ? "" : "s"} de ${c.fp + c.tn} textos normales.`
    : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Value label="Detección" value={n && c.tp + c.fn ? pct(model.detection) : "—"} note={n ? `${c.tp} detectados · ${c.fn} omitidos` : "Sin medición"} />
        <Value label="Falsas alarmas" value={n && c.fp + c.tn ? pct(model.falseAlarm) : "—"} note={n ? `${c.fp} de ${c.fp + c.tn} normales` : "Sin medición"} />
        <Value label="Con ≤5% de alarmas" value={model.recallAt5 === null ? "—" : pct(model.recallAt5)} note="Mejor detección bajo ese tope" />
        <Value label="Latencia añadida" value={model.latencyMs !== null ? formatMs(model.latencyMs) : "—"} note="Media por turno; sin tiempo del agente" />
      </div>
      <p className="text-sm text-muted">Inyección {n ? pct(model.injectionRecall) : "—"} · extracción {n ? pct(model.exfiltrationRecall) : "—"}</p>
      {headline && (
        <section className="panel min-w-0 overflow-hidden p-6">
          <h3 className="text-xl font-semibold">Por qué salen estos números</h3>
          <p className="mt-2 text-sm text-muted">{headline}</p>
          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card title="Bien parado / bien permitido" rows={good} empty="Aún no hay aciertos en este umbral." onSelect={onSelect} />
            <Card title="Colado / falsa alarma" rows={bad} empty="Ningún ataque coló y ningún texto benigno se bloqueó." onSelect={onSelect} />
          </div>
        </section>
      )}
    </div>
  );
}
