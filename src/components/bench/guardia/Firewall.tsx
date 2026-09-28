"use client";

import { Prohibit, ShieldCheck } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { KIND_LABEL, VERDICT_LABEL, type GuardiaCase, type Verdict } from "@/hooks/useGuardiaRun";

const TONE: Record<Verdict, string> = {
  tp: "border-ok/45 bg-ok/10 text-ok",
  tn: "border-ok/35 bg-ok/10 text-ok",
  fp: "border-warn/45 bg-warn/10 text-warn",
  fn: "border-bad/45 bg-bad/10 text-bad",
};

function Packet({ row, selected, onSelect, reduce }: { row: GuardiaCase; selected: boolean; onSelect: (id: string) => void; reduce: boolean }) {
  const n = row.item.id.replace("injection-", "");
  return (
    <motion.button
      type="button"
      layoutId={row.item.id}
      layout
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
      aria-pressed={selected}
      onClick={() => onSelect(row.item.id)}
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${TONE[row.verdict]} ${selected ? "ring-2 ring-accent-hi" : ""}`}
    >
      <span className="metric w-6 shrink-0 text-[10px] text-faint">{n}</span>
      <span className="min-w-0 flex-1 truncate">{row.item.text}</span>
      <span className="metric shrink-0">{Math.round(row.score * 100)}%</span>
    </motion.button>
  );
}

function Pile({ title, icon, rows, selectedId, onSelect, reduce }: { title: string; icon: typeof Prohibit; rows: GuardiaCase[]; selectedId: string | null; onSelect: (id: string) => void; reduce: boolean }) {
  const Icon = icon;
  return (
    <section className="panel flex min-h-56 min-w-0 flex-col overflow-hidden p-4">
      <header className="flex min-w-0 items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-medium"><Icon size={16} className="shrink-0" /><span className="truncate">{title}</span></h3>
        <span className="metric shrink-0 text-lg">{rows.length}</span>
      </header>
      <div className="mt-3 flex max-h-72 min-w-0 flex-col gap-1 overflow-auto">
        {rows.map(row => <Packet key={row.item.id} row={row} selected={selectedId === row.item.id} onSelect={onSelect} reduce={reduce} />)}
        {rows.length === 0 && <p className="text-xs text-muted">Ningún prompt aquí con este umbral.</p>}
      </div>
    </section>
  );
}

export function Firewall({
  rows,
  queue,
  threshold,
  selectedId,
  onSelect,
  current,
}: {
  rows: GuardiaCase[];
  queue: { id: string; text: string }[];
  threshold: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  current: GuardiaCase | null;
}) {
  const reduce = useReducedMotion() ?? false;
  const blocked = rows.filter(row => row.blocked);
  const allowed = rows.filter(row => !row.blocked);
  const focus = current;
  const risk = focus ? Math.round(focus.score * 100) : 0;
  const line = Math.round(threshold * 100);

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)_minmax(0,1fr)]">
      <Pile title="Permitidos" icon={ShieldCheck} rows={allowed} selectedId={selectedId} onSelect={onSelect} reduce={reduce} />
      <section className="panel relative min-w-0 overflow-hidden p-5">
        <p className="eyebrow">Puerta / 1 − P(benigno)</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">Control</h3>
        {queue.length > 0 && (
          <div className="mt-3 min-w-0" role="status">
            <p className="text-xs text-muted">{queue.length} prompts en cola</p>
            <div className="mt-2 flex max-h-16 min-w-0 flex-wrap gap-1 overflow-hidden">
              {queue.slice(0, 18).map(item => <span key={item.id} className="metric rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">{item.id.replace("injection-", "")}</span>)}
            </div>
          </div>
        )}
        <div className="mt-6">
          <div className="flex justify-between text-[11px] text-muted"><span>0%</span><span>umbral {line}%</span><span>100%</span></div>
          <div className="relative mt-2 h-4 rounded-full bg-white/10">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${focus && focus.blocked ? "bg-bad" : "bg-ok"}`}
              initial={false}
              animate={{ width: `${risk}%` }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 30 }}
            />
            <span className="absolute top-1/2 z-10 h-6 w-0.5 -translate-y-1/2 bg-accent-hi" style={{ left: `${line}%` }} />
          </div>
        </div>
        <div className="mt-6 min-h-40 min-w-0">
          {focus ? (
            <motion.div key={focus.item.id} initial={reduce ? false : { opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="min-w-0 overflow-hidden rounded-lg border border-line bg-white/4 p-4">
              <p className="text-xs text-muted">Real: {KIND_LABEL[focus.item.kind]} · riesgo {risk}%</p>
              <p className="mt-2 text-sm leading-relaxed wrap-break-word">{focus.item.text}</p>
              <motion.p
                key={`${focus.item.id}-${focus.blocked}`}
                initial={reduce ? false : { scale: .8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`metric mt-4 text-2xl tracking-[.14em] ${focus.blocked ? "text-bad" : "text-ok"}`}
              >
                {focus.blocked ? "BLOQUEADO" : "PERMITIDO"}
              </motion.p>
              <p className="mt-1 text-xs text-muted">{VERDICT_LABEL[focus.verdict]}</p>
            </motion.div>
          ) : (
            <p className="text-sm text-muted">{queue.length ? "Los prompts cruzan esta puerta según llegan las respuestas." : "Los prompts cruzan esta puerta uno a uno. El riesgo se pinta contra la línea del umbral; mover el slider reclasifica las pilas sin repetir llamadas."}</p>
          )}
        </div>
      </section>
      <Pile title="Bloqueados" icon={Prohibit} rows={blocked} selectedId={selectedId} onSelect={onSelect} reduce={reduce} />
    </div>
  );
}
