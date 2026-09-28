"use client";

import { ArrowDown, Cpu, HardDrives, User } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { CascadaTicket, Station, StationStats } from "@/hooks/useCascadaRun";
import { DEPT_LABEL } from "@/hooks/useCascadaRun";
import { formatMs, formatUsd } from "@/lib/ai/pricing";

const META: Record<Station, { title: string; hint: string; icon: typeof Cpu; color: string }> = {
  laya: { title: "Laya", hint: "Barato y local", icon: HardDrives, color: "var(--laya)" },
  jev: { title: "Jev", hint: "Solo si Laya duda", icon: Cpu, color: "var(--accent-hi)" },
  human: { title: "Humano", hint: "Revisión estimada perfecta", icon: User, color: "var(--warn)" },
};

function pct(value: number, ready: boolean) {
  return ready ? `${Math.round(value * 100)}%` : "—";
}

function TicketChip({ item, selected, onSelect, reduce }: { item: CascadaTicket; selected: boolean; onSelect: (id: string) => void; reduce: boolean }) {
  const n = item.ticket.id.replace("ticket-", "");
  const ok = item.station === "human" ? null : item.finalCorrect;
  const tone = ok === true ? "border-ok/45 bg-ok/15 text-ok" : ok === false ? "border-bad/45 bg-bad/15 text-bad" : "border-laya/40 bg-laya/10 text-laya";
  return (
    <motion.button
      type="button"
      layoutId={item.ticket.id}
      layout
      initial={reduce ? false : { opacity: 0, scale: .72 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
      aria-pressed={selected}
      aria-label={`Ticket ${n}, ${META[item.station].title}, ${ok === null ? "revisión humana" : ok ? "acierto" : "error"}`}
      title={`#${n} · ${DEPT_LABEL[item.ticket.department]} · ${item.station === "laya" ? Math.round(item.laya.confidence * 100) : item.jev ? Math.round(item.jev.confidence * 100) : "—"}%`}
      onClick={() => onSelect(item.ticket.id)}
      className={`metric h-9 min-w-9 rounded-md border px-1.5 text-[11px] ${tone} ${selected ? "ring-2 ring-accent-hi ring-offset-2 ring-offset-surface" : ""}`}
    >
      {n}
    </motion.button>
  );
}

function StationColumn({
  station,
  stats,
  items,
  total,
  selectedId,
  onSelect,
  reduce,
}: {
  station: Station;
  stats: StationStats;
  items: CascadaTicket[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reduce: boolean;
}) {
  const meta = META[station];
  const Icon = meta.icon;
  const share = total ? stats.n / total : 0;
  return (
    <section className="panel relative flex min-h-72 min-w-0 flex-col overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${meta.color} ${share * 100}%, rgb(255 255 255 / .08) ${share * 100}%)` }} />
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow" style={{ color: meta.color }}>{meta.hint}</p>
          <h3 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight"><Icon size={20} />{meta.title}</h3>
        </div>
        <span className="metric text-2xl tabular-nums">{stats.n}</span>
      </header>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-muted">Acierto</dt><dd className="metric mt-1 text-sm">{station === "human" ? (stats.n ? "100% est." : "—") : pct(stats.accuracy, stats.n > 0)}</dd></div>
        <div><dt className="text-muted">Coste</dt><dd className="metric mt-1 text-sm">{station === "human" ? "no incl." : station === "laya" ? "$0" : stats.n ? formatUsd(stats.costUsd) : "—"}</dd></div>
        <div><dt className="text-muted">Tiempo</dt><dd className="metric mt-1 text-sm">{station === "human" ? "no incl." : stats.n ? formatMs(stats.timeMs) : "—"}</dd></div>
      </dl>
      <div className="mt-4 flex min-h-36 flex-wrap content-start gap-1.5" aria-live="polite">
        {items.map(item => <TicketChip key={item.ticket.id} item={item} selected={selectedId === item.ticket.id} onSelect={onSelect} reduce={reduce} />)}
        {items.length === 0 && <p className="self-center text-xs text-muted">Nadie se queda aquí con estos umbrales.</p>}
      </div>
    </section>
  );
}

function Pipe() {
  return (
    <div className="flex items-center justify-center py-1 lg:px-1" aria-hidden="true">
      <ArrowDown className="text-faint lg:hidden" size={18} />
      <span className="hidden h-px w-4 bg-white/20 lg:block" />
      <span className="hidden text-faint lg:block">→</span>
      <span className="hidden h-px w-4 bg-white/20 lg:block" />
    </div>
  );
}

export function CascadeStations({
  items,
  stations,
  selectedId,
  onSelect,
  incoming,
}: {
  items: CascadaTicket[];
  stations: { laya: StationStats; jev: StationStats; human: StationStats };
  selectedId: string | null;
  onSelect: (id: string) => void;
  incoming: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const total = items.length + incoming;
  const grouped: Record<Station, CascadaTicket[]> = { laya: [], jev: [], human: [] };
  for (const item of items) grouped[item.station].push(item);
  return (
    <div>
      {incoming > 0 && (
        <p className="mb-3 text-sm text-muted" role="status">
          Entran en Laya: <strong className="metric text-ink">{incoming}</strong> fichas aún en cola · {items.length} ya repartidas
        </p>
      )}
      <div className="flex min-w-0 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
        <StationColumn station="laya" stats={stations.laya} items={grouped.laya} total={total} selectedId={selectedId} onSelect={onSelect} reduce={reduce} />
        <Pipe />
        <StationColumn station="jev" stats={stations.jev} items={grouped.jev} total={total} selectedId={selectedId} onSelect={onSelect} reduce={reduce} />
        <Pipe />
        <StationColumn station="human" stats={stations.human} items={grouped.human} total={total} selectedId={selectedId} onSelect={onSelect} reduce={reduce} />
      </div>
      <p className="mt-3 text-xs text-muted">Verde: acierto. Rojo: alta confianza y error. Lila: revisión humana (se estima perfecta). Pulsa una ficha para ver el ticket.</p>
    </div>
  );
}
