"use client";

import { Buildings, CaretDown, CheckCircle, CircleNotch, EnvelopeSimple, EnvelopeSimpleOpen, Lightning, SignOut, Tray, User, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHealth } from "@/hooks/useHealth";
import { useBandejaRun, type Pilot } from "@/hooks/useBandejaRun";
import { byPilot, MODEL_PILOTS, PILOT_COLOR, PILOT_LABEL } from "@/lib/ai/pilots";
import { formatMs, formatUsd } from "@/lib/ai/pricing";
import { addHistory } from "@/lib/history";
import { tickets } from "@/lib/data/tickets";
import {
  DEPT_LABEL,
  URGENCY_LABEL,
  bandejaCases,
  bandejaCompare,
  bandejaHeadline,
  departmentBaselines,
  explainTicket,
  pct,
  senderOf,
  statsFromVerdicts,
  subjectOf,
  verdictFromHuman,
  verdictFromResult,
  type BandejaCase,
  type HumanTicket,
  type PilotStats,
  type TicketVerdict,
} from "./explain";

type Folder = Pilot | "human";

function RunButtons({ ids, running, onRun, onCancel }: { ids: string[]; running: { pilot: Pilot; done: number; total: number } | null; onRun: (pilot: Pilot, ids: string[]) => void; onCancel: () => void }) {
  const health = useHealth();
  return <div className="flex flex-wrap items-center gap-3">
    {MODEL_PILOTS.map(pilot => <button key={pilot} type="button" className={`btn ${pilot === "jev" ? "btn-primary" : ""}`} disabled={!!running || !health[pilot].ok} onClick={() => onRun(pilot, ids)}>Medir {PILOT_LABEL[pilot]}</button>)}
    {running && <>
      <span className="metric text-sm text-muted" role="status">{running.pilot}: {running.done}/{running.total}</span>
      <div className="h-1.5 w-36 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={running.total} aria-valuenow={running.done}><div className="h-full bg-accent-hi" style={{ width: `${running.total ? running.done / running.total * 100 : 0}%` }} /></div>
      <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
    </>}
    {MODEL_PILOTS.filter(pilot => !health[pilot].ok).map(pilot => <span key={pilot} className="text-xs text-warn">{PILOT_LABEL[pilot]}: {health[pilot].detail}</span>)}
  </div>;
}

function Stamp({ label, ok, thinking, delay }: { label: string; ok?: boolean; thinking?: boolean; delay: number }) {
  const reduce = useReducedMotion();
  return <motion.span
    initial={reduce ? false : { opacity: 0, y: -6, scale: 0.92 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", stiffness: 420, damping: 28, delay: reduce ? 0 : delay }}
    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${thinking ? "border-line text-muted" : ok ? "border-ok/35 bg-ok/12 text-ok" : "border-bad/35 bg-bad/12 text-bad"}`}
  >{thinking ? "pensando…" : label}</motion.span>;
}

function Avatar({ id }: { id: string }) {
  const sender = senderOf(id);
  const palette = ["var(--p-i)", "var(--p-o)", "var(--p-t)", "var(--p-s)", "var(--p-z)", "var(--p-j)", "var(--p-l)"];
  const color = palette[Math.max(0, Number(id.replace(/\D/g, "")) - 1) % palette.length];
  return <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-[#08101c]" style={{ background: color }}>{sender.initials}</span>;
}

function deltaChip(delta: number | null, empty: string) {
  if (delta === null) return <span className="text-[11px] text-faint">{empty}</span>;
  const points = Math.round(delta * 100);
  const tone = points > 0 ? "text-ok" : points < 0 ? "text-bad" : "text-muted";
  return <span className={`metric text-[11px] ${tone}`}>{points > 0 ? `+${points}` : points} pp</span>;
}

function RecapCard({ title, tone, cases, onOpen }: { title: string; tone: "ok" | "bad"; cases: BandejaCase[]; onOpen: (id: string) => void }) {
  return <div className={`rounded-lg border p-4 ${tone === "ok" ? "border-ok/25 bg-ok/5" : "border-bad/25 bg-bad/5"}`}>
    <p className="flex items-center gap-1.5 text-sm font-medium">{tone === "ok" ? <CheckCircle size={16} className="text-ok" /> : <WarningCircle size={16} className="text-bad" />}{title}</p>
    {cases.length ? <ul className="mt-3 space-y-2">{cases.map(item => <li key={`${title}-${item.id}`}>
      <button type="button" onClick={() => onOpen(item.id)} className="w-full rounded-md border border-line bg-surface/70 px-3 py-2.5 text-left hover:bg-white/6">
        <span className="block truncate text-sm">{item.subject}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={`rounded border px-1.5 py-0.5 ${item.ok ? "border-ok/35 text-ok" : "border-bad/35 text-bad"}`}>{item.decided}</span>
          {!item.ok && <span className="text-muted">era {item.truth}</span>}
          <span className="text-faint">{item.field}</span>
        </span>
        <span className="mt-1.5 block text-xs leading-relaxed text-muted">{item.why}</span>
      </button>
    </li>)}</ul> : <p className="mt-3 text-xs text-muted">{tone === "ok" ? "Ningún ticket salió limpio en los tres campos." : "No hay fallos que mostrar."}</p>}
  </div>;
}

function ResultsTable({ stats, majority }: { stats: Record<Folder, PilotStats>; majority: ReturnType<typeof departmentBaselines> }) {
  const rows = ([...MODEL_PILOTS.map(pilot => [pilot, PILOT_LABEL[pilot], PILOT_COLOR[pilot]] as const), ["human", "Persona", "var(--warn)"] as const] as const).filter(([id]) => stats[id].n > 0);
  if (!rows.length) return null;
  const fields = [["department", "Departamento"], ["urgency", "Urgencia"], ["churn", "Riesgo de baja"]] as const;
  const best = Object.fromEntries(fields.map(([key]) => [key, Math.max(...rows.map(([id]) => stats[id][key]))])) as Record<(typeof fields)[number][0], number>;
  const fastest = Math.min(...rows.map(([id]) => stats[id].ms));
  return <section className="panel overflow-hidden" aria-labelledby="bandeja-results">
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 sm:px-6">
      <div><p className="eyebrow">Resultados</p><h3 id="bandeja-results" className="mt-1 text-lg font-semibold">Aciertos por campo, sobre {tickets.length} tickets</h3></div>
      <p className="text-xs text-muted">Resaltado: el mejor de cada columna.</p>
    </div>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead><tr className="border-y border-line text-left text-[11px] text-muted">
          <th className="px-5 py-2 font-normal sm:px-6">Piloto</th>
          {fields.map(([key, label]) => <th key={key} className="px-3 py-2 font-normal">{label}</th>)}
          <th className="px-3 py-2 text-right font-normal">Tiempo / ticket</th>
          <th className="px-5 py-2 text-right font-normal sm:px-6">Coste / 1.000</th>
        </tr></thead>
        <tbody>
          {rows.map(([id, label, color]) => {
            const s = stats[id];
            return <tr key={id} className="border-b border-line">
              <th scope="row" className="px-5 py-3 text-left font-medium sm:px-6"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: color }} />{label}{s.n < tickets.length && <span className="ml-1 text-[11px] font-normal text-faint">({s.n})</span>}</th>
              {fields.map(([key]) => {
                const hits = Math.round(s[key] * s.n);
                const top = s[key] === best[key] && rows.length > 1;
                return <td key={key} className="px-3 py-3">
                  <p className={`metric ${top ? "text-ok" : "text-ink"}`}><span className="text-lg">{hits}</span><span className="text-faint">/{s.n}</span> <span className="text-xs text-muted">{pct(s[key], true)}</span></p>
                  <div className="mt-1.5 h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-white/8" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${s[key] * 100}%`, background: color }} /></div>
                  {key === "urgency" && <p className="mt-1 text-[11px] text-faint">error medio {s.urgencyError.toFixed(2)} niveles</p>}
                </td>;
              })}
              <td className={`metric px-3 py-3 text-right ${s.ms === fastest && rows.length > 1 ? "text-ok" : ""}`}>{formatMs(s.ms)}</td>
              <td className="metric px-5 py-3 text-right sm:px-6">{id === "human" ? <span className="text-faint">no estimado</span> : formatUsd(s.cost)}</td>
            </tr>;
          })}
          <tr className="text-muted">
            <th scope="row" className="px-5 py-3 text-left text-xs font-normal sm:px-6">Siempre la clase más común</th>
            {fields.map(([key]) => <td key={key} className="metric px-3 py-3 text-xs">{Math.round(majority[key] * tickets.length)}/{tickets.length} {pct(majority[key], true)}</td>)}
            <td className="px-3 py-3" /><td className="px-5 py-3 sm:px-6" />
          </tr>
        </tbody>
      </table>
    </div>
    <p className="px-5 py-4 text-xs text-muted sm:px-6">Una llamada del modelo responde los tres campos a la vez; la persona pulsa tres teclas. La última fila es la línea base: acertar siempre con la etiqueta más frecuente.</p>
  </section>;
}

function LiveCounters({ stats, folder }: { stats: PilotStats; folder: Folder }) {
  const ready = stats.n > 0;
  return <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-5" aria-live="polite">
    {[
      { label: "Departamento", value: pct(stats.department, ready), note: `${stats.n} ticket${stats.n === 1 ? "" : "s"}` },
      { label: "Urgencia", value: pct(stats.urgency, ready), note: ready ? `error ${stats.urgencyError.toFixed(2)}` : "sin datos" },
      { label: "Baja", value: pct(stats.churn, ready), note: ready ? `${Math.round(stats.churn * stats.n)} aciertos` : "sin datos" },
      { label: "Tiempo / ticket", value: ready ? formatMs(stats.ms) : "—", note: folder === "human" ? "tres teclas" : "una llamada" },
      { label: "Coste / 1.000", value: folder === "human" ? "n/e" : ready ? formatUsd(stats.cost) : "—", note: folder === "laya" ? "sin tokens cobrados" : folder === "human" ? "no estimado" : folder === "jev" ? "solo entrada Jev" : "facturado por OpenRouter" },
    ].map(item => <div key={item.label} className="bg-surface px-4 py-3"><p className="text-[11px] text-muted">{item.label}</p><p className="metric mt-1 text-xl">{item.value}</p><p className="mt-0.5 text-[11px] text-faint">{item.note}</p></div>)}
  </div>;
}

function MailRow({ verdict, thinking, fresh, open, onToggle }: { verdict: TicketVerdict | null; thinking: boolean; fresh: boolean; open: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const id = verdict?.ticket.id;
  useEffect(() => {
    if (!open || !id) return;
    document.getElementById(`mail-${id}`)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [open, id, reduce]);
  if (!id) return null;
  const sender = senderOf(id);
  const ticketData = tickets.find(item => item.id === id)!;
  const why = verdict && !thinking ? explainTicket(verdict) : null;
  return <motion.article
    layout={reduce ? false : true}
    initial={reduce || !fresh ? false : { opacity: 0, y: -16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={reduce ? undefined : { opacity: 0, height: 0 }}
    transition={{ type: "spring", stiffness: 320, damping: 32 }}
    className={`border-b border-line ${open ? "bg-white/4" : "hover:bg-white/3"}`}
    id={`mail-${id}`}
  >
    <button type="button" className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3 text-left sm:grid-cols-[auto_10rem_1fr_auto]" aria-expanded={open} onClick={onToggle}>
      {open ? <EnvelopeSimpleOpen size={18} className="mt-1 text-accent-hi" /> : <EnvelopeSimple size={18} className="mt-1 text-faint" />}
      <span className="hidden min-w-0 sm:flex sm:flex-col">
        <span className="flex items-center gap-2 truncate text-sm font-medium"><Avatar id={id} /><span className="truncate">{sender.name}</span></span>
        <span className="truncate pl-10 text-[11px] text-muted">{sender.email}</span>
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 sm:hidden"><Avatar id={id} /><span className="truncate text-sm font-medium">{sender.name}</span></span>
        <span className="mt-1 block truncate text-sm sm:mt-0">{subjectOf(ticketData.text)}</span>
        {!open && <span className="mt-0.5 block truncate text-xs text-muted">{ticketData.text}</span>}
      </span>
      <span className="flex max-w-[11rem] flex-wrap justify-end gap-1 sm:max-w-none">
        {thinking ? <>
          <Stamp label="" thinking delay={0} />
          <Stamp label="" thinking delay={0.05} />
          <Stamp label="" thinking delay={0.1} />
        </> : verdict ? <>
          <Stamp label={verdict.department.predicted ? DEPT_LABEL[verdict.department.predicted as keyof typeof DEPT_LABEL] ?? String(verdict.department.predicted) : "sin depto."} ok={verdict.department.ok} delay={0} />
          <Stamp label={typeof verdict.urgency.predicted === "number" ? `Urg. ${verdict.urgency.predicted}` : "sin urgencia"} ok={verdict.urgency.ok} delay={0.07} />
          <Stamp label={verdict.churn.predicted === null ? "sin baja" : verdict.churn.predicted ? "Baja" : "Se queda"} ok={verdict.churn.ok} delay={0.14} />
        </> : null}
        <CaretDown size={14} className={`mt-1 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </span>
    </button>
    <AnimatePresence>
      {open && verdict && why && <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} className="space-y-4 px-4 pb-5 sm:pl-[3.25rem]">
        <div className="rounded-lg border border-line bg-white/3 p-4">
          <p className="text-[11px] text-muted">De {sender.name} &lt;{sender.email}&gt; · Para soporte · {id}</p>
          <p className="mt-3 text-base leading-relaxed">{ticketData.text}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["Departamento", <Buildings key="d" size={14} />, verdict.department, DEPT_LABEL[ticketData.department], verdict.department.predicted ? DEPT_LABEL[verdict.department.predicted as keyof typeof DEPT_LABEL] ?? String(verdict.department.predicted) : "—", why.fields.department],
            ["Urgencia", <Lightning key="u" size={14} />, verdict.urgency, `${ticketData.urgency} ${URGENCY_LABEL[ticketData.urgency]}`, typeof verdict.urgency.predicted === "number" ? `${verdict.urgency.predicted} ${URGENCY_LABEL[verdict.urgency.predicted] ?? ""}` : "—", why.fields.urgency],
            ["Baja", <SignOut key="c" size={14} />, verdict.churn, ticketData.churn ? "Sí, amenaza" : "No", verdict.churn.predicted === null ? "—" : verdict.churn.predicted ? "Sí, amenaza" : "No", why.fields.churn],
          ] as const).map(([label, icon, field, truth, decided, note]) => <div key={label} className={`rounded-lg border p-3 ${field.ok ? "border-ok/30" : "border-bad/30"}`}>
            <p className="flex items-center gap-1.5 text-[11px] text-muted">{icon}{label}</p>
            <p className="mt-2 text-sm">Decidió <strong>{decided}</strong></p>
            <p className="text-sm text-muted">Correcto: {truth}</p>
            {field.confidence !== null && <p className="metric mt-1 text-[11px] text-faint">{Math.round(field.confidence * 100)}% confianza</p>}
            <p className="mt-2 text-xs leading-relaxed text-muted">{note}</p>
          </div>)}
        </div>
        <p className="text-sm leading-relaxed text-muted">{why.overall}</p>
      </motion.div>}
    </AnimatePresence>
  </motion.article>;
}

export function BandejaBench() {
  const { results, progress, pending, arrived, error, ready, run, cancel } = useBandejaRun("bandeja");
  const [folder, setFolder] = useState<Folder>("jev");
  const [openId, setOpenId] = useState<string | null>(null);
  const [human, setHuman] = useState<Record<string, HumanTicket>>({});
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [draft, setDraft] = useState<Partial<HumanTicket>>({});
  const [startedAt, setStartedAt] = useState(0);
  const reduce = useReducedMotion();
  const ticket = tickets[index];
  const majority = useMemo(() => departmentBaselines(), []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setStartedAt(performance.now()));
    return () => cancelAnimationFrame(frame);
  }, [index]);

  const answer = useCallback((value: string | number | boolean, at: number) => {
    if (!ticket) return;
    if (stage === 0) { setDraft({ department: String(value) }); setStage(1); }
    else if (stage === 1) { setDraft(previous => ({ ...previous, urgency: Number(value) })); setStage(2); }
    else {
      const entry = { department: draft.department || "", urgency: draft.urgency ?? 0, churn: Boolean(value), ms: at - startedAt };
      setHuman(previous => ({ ...previous, [ticket.id]: entry }));
      setIndex(index + 1); setStage(0); setDraft({});
      if (index === tickets.length - 1) addHistory({ kind: "bandeja", label: "Bandeja / humano", detail: `${tickets.length} tickets etiquetados` });
    }
  }, [draft.department, draft.urgency, index, stage, startedAt, ticket]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (folder !== "human" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = event.key.toLowerCase();
      const at = event.timeStamp;
      if (stage === 0 && ["1", "2", "3"].includes(key)) answer(["billing", "technical", "account"][Number(key) - 1], at);
      if (stage === 1 && ["0", "1", "2", "3"].includes(key)) answer(Number(key), at);
      if (stage === 2 && ["y", "s", "n"].includes(key)) answer(key !== "n", at);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [answer, folder, stage]);

  const verdicts = useMemo(() => {
    const of = (pilot: Folder) => tickets.flatMap(item => {
      if (pilot === "human") {
        const entry = human[item.id];
        return entry ? [verdictFromHuman(item, entry)] : [];
      }
      const row = verdictFromResult(item, results[pilot][item.id]);
      return row ? [row] : [];
    });
    return { ...byPilot(pilot => of(pilot)), human: of("human") };
  }, [human, results]);

  const stats: Record<Folder, PilotStats> = { ...byPilot(pilot => statsFromVerdicts(verdicts[pilot])), human: statsFromVerdicts(verdicts.human) };

  const liveIds = useMemo(() => {
    if (folder === "human") return tickets.map(item => item.id).filter(id => human[id]);
    const runningHere = progress?.pilot === folder;
    if (runningHere || arrived.length) {
      const seen = new Set<string>();
      const list: string[] = [];
      if (runningHere) for (const id of pending) if (!seen.has(id)) { seen.add(id); list.push(id); }
      for (const id of [...arrived].reverse()) if (!seen.has(id) && results[folder][id]) { seen.add(id); list.push(id); }
      if (!runningHere) for (const item of tickets) if (!seen.has(item.id) && results[folder][item.id]) { seen.add(item.id); list.push(item.id); }
      return list;
    }
    return tickets.map(item => item.id).filter(id => results[folder][id]);
  }, [arrived, folder, human, pending, progress, results]);

  const fresh = new Set(arrived);

  return <div className="space-y-5">
    <section className="panel p-6">
      <p className="eyebrow">60 tickets / 3 decisiones / 1 llamada</p>
      <h2 className="mt-2 text-2xl font-semibold">Clasifica la bandeja</h2>
      <p className="mt-2 text-sm text-muted">Departamento, urgencia y riesgo de baja se preguntan juntos. Un fallo de red cuenta como error. La línea de mayoría es depto. {pct(majority.department, true)}, urgencia {pct(majority.urgency, true)}, baja {pct(majority.churn, true)}.</p>
      <div className="mt-6"><RunButtons ids={tickets.map(item => item.id)} running={progress} onRun={(pilot, ids) => { setFolder(pilot); void run(pilot, ids); }} onCancel={cancel} /></div>
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error} La pasada continúa con el resto.</p>}
    </section>

    <ResultsTable stats={stats} majority={majority} />

    <section id="bandeja-inbox" className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium"><Tray size={18} /> Bandeja de entrada</p>
        <p className="text-xs text-muted">Los sellos salen en verde o rojo contra la verdad editorial. Abre un correo para ver por qué.</p>
      </div>
      <LiveCounters stats={stats[folder]} folder={folder} />
      <div className="grid lg:grid-cols-[12.5rem_1fr]">
        <nav aria-label="Pilotos" className="flex gap-1 overflow-x-auto border-b border-line p-2 lg:flex-col lg:border-b-0 lg:border-r">
          {([...MODEL_PILOTS.map(pilot => [pilot, PILOT_LABEL[pilot], stats[pilot].n] as const), ["human", "Persona", stats.human.n] as const]).map(([id, label, n]) => <button key={id} type="button" aria-pressed={folder === id} onClick={() => setFolder(id)} className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${folder === id ? "bg-white/8 text-ink" : "text-muted hover:bg-white/5 hover:text-ink"}`}>
            <span className="flex items-center gap-2">{id === "human" ? <User size={16} /> : <Tray size={16} />}{label}</span>
            <span className="metric text-xs">{ready || id === "human" ? n : "…"}</span>
          </button>)}
        </nav>
        <div>
          {folder === "human" && ticket && <div className="border-b border-line bg-white/3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Ticket {index + 1} de {tickets.length} · el reloj arranca al mostrar el correo</p>
                <p className="mt-1 text-sm font-medium">{senderOf(ticket.id).name}</p>
              </div>
              <span className="metric text-xs text-muted">{Object.keys(human).length} hechos</span>
            </div>
            <blockquote className="mt-3 text-base leading-relaxed">{ticket.text}</blockquote>
            <p className="mt-4 text-sm text-muted">{stage === 0 ? "1 Facturación · 2 Técnico · 3 Cuenta" : stage === 1 ? "Urgencia: 0 Informativo · 1 Normal · 2 Alta · 3 Crítica" : "¿Amenaza con irse? S o Y Sí · N No"}</p>
            <div className="mt-3 flex flex-wrap gap-2">{(stage === 0 ? [["1 Facturación", "billing"], ["2 Técnico", "technical"], ["3 Cuenta", "account"]] : stage === 1 ? [["0", 0], ["1", 1], ["2", 2], ["3", 3]] : [["S Sí", true], ["N No", false]]).map(([label, value]) => <button key={String(label)} type="button" className="btn" onClick={event => answer(value as string | number | boolean, event.timeStamp)}>{label}</button>)}</div>
          </div>}
          {folder === "human" && !ticket && <p className="border-b border-line px-4 py-3 text-sm text-ok">Los 60 tickets están etiquetados.</p>}
          <div className="max-h-[70vh] overflow-auto" role="list">
            <AnimatePresence initial={false}>
              {liveIds.map(id => {
                const thinking = folder !== "human" && pending.includes(id);
                const ticketData = tickets.find(item => item.id === id)!;
                const verdict = folder === "human" ? (human[id] ? verdictFromHuman(ticketData, human[id]) : null) : verdictFromResult(ticketData, results[folder][id]);
                if (!verdict && !thinking) return null;
                const placeholder: TicketVerdict = verdict ?? { ticket: ticketData, failed: false, ms: 0, cost: 0, department: { predicted: null, truth: ticketData.department, confidence: null, ok: false }, urgency: { predicted: null, truth: ticketData.urgency, confidence: null, ok: false, error: 3 }, churn: { predicted: null, truth: ticketData.churn, confidence: null, ok: false } };
                return <div key={id} role="listitem"><MailRow verdict={placeholder} thinking={thinking} fresh={fresh.has(id) || thinking} open={openId === id} onToggle={() => !thinking && setOpenId(openId === id ? null : id)} /></div>;
              })}
            </AnimatePresence>
            {!liveIds.length && folder !== "human" && <div className="grid place-items-center px-6 py-16 text-center">
              {progress?.pilot === folder ? <p className="flex items-center gap-2 text-sm text-muted"><CircleNotch size={18} className={reduce ? "" : "animate-spin"} /> Esperando el primer correo…</p> : !ready ? <p className="flex items-center gap-2 text-sm text-muted"><CircleNotch size={18} className={reduce ? "" : "animate-spin"} /> Cargando la carpeta…</p> : <p className="max-w-sm text-sm text-muted">La carpeta está vacía. Mide {PILOT_LABEL[folder]} para ver cómo van llegando los 60 tickets, con sellos de departamento, urgencia y baja.</p>}
            </div>}
            {folder === "human" && !liveIds.length && ticket && <p className="px-4 py-8 text-center text-sm text-muted">Los correos etiquetados irán apareciendo debajo.</p>}
          </div>
        </div>
      </div>
    </section>

    {([...MODEL_PILOTS, "human"] as const).map(pilot => {
      const s = stats[pilot];
      if (s.n < tickets.length) return null;
      const name = pilot === "human" ? "La persona" : PILOT_LABEL[pilot];
      const humanStats = pilot === "human" ? null : stats.human.n ? stats.human : null;
      const cases = bandejaCases(verdicts[pilot]);
      const compare = bandejaCompare(s, majority, humanStats);
      return <section key={pilot} className="panel p-6">
        <p className="eyebrow">Qué ha pasado · {name}</p>
        <h3 className="mt-2 text-lg font-semibold">{bandejaHeadline(name, verdicts[pilot], s)}</h3>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <RecapCard title="Lo ha resuelto bien" tone="ok" cases={cases.good} onOpen={id => { setFolder(pilot); setOpenId(id); document.getElementById("bandeja-inbox")?.scrollIntoView({ block: "start", behavior: "smooth" }); }} />
          <RecapCard title="Lo ha resuelto mal" tone="bad" cases={cases.bad} onOpen={id => { setFolder(pilot); setOpenId(id); document.getElementById("bandeja-inbox")?.scrollIntoView({ block: "start", behavior: "smooth" }); }} />
        </div>
        <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          {compare.map(item => <div key={item.label} className="bg-surface px-4 py-3">
            <p className="flex items-center justify-between text-[11px] text-muted">{item.label}<span className="metric text-sm text-ink">{pct(item.value, true)}</span></p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8" aria-hidden="true"><div className="h-full bg-accent-hi" style={{ width: `${Math.round(item.value * 100)}%` }} /></div>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <span>mayoría {pct(item.majority, true)} {deltaChip(item.vsMajority, "")}</span>
              <span className="text-faint">·</span>
              {item.vsHuman === null ? <span className="text-faint">sin persona</span> : <span>persona {pct(item.human ?? 0, true)} {deltaChip(item.vsHuman, "")}</span>}
            </p>
          </div>)}
        </div>
      </section>;
    })}
  </div>;
}
