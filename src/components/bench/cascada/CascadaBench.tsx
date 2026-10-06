"use client";

import { ArrowRight, Pause, Play } from "@phosphor-icons/react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { CascadeReport, CascadeVerdict } from "@/components/bench/cascada/CascadeReport";
import { CascadeStations } from "@/components/bench/cascada/CascadeStations";
import { TicketDetail } from "@/components/bench/cascada/TicketDetail";
import { FIRST_PILOTS, stationStats, useCascadaRun, type CascadaTicket, type FirstPilot } from "@/hooks/useCascadaRun";
import { useHealth } from "@/hooks/useHealth";
import { useReveal } from "@/hooks/useReveal";
import { PILOT_COLOR, PILOT_LABEL, type ModelPilot } from "@/lib/ai/pilots";

function RunButtons({ pilots, ids, running, onRun, onCancel }: { pilots: ModelPilot[]; ids: string[]; running: { pilot: ModelPilot; done: number; total: number } | null; onRun: (pilot: ModelPilot, ids: string[]) => void; onCancel: () => void }) {
  const health = useHealth();
  return <div className="flex min-w-0 flex-wrap items-center gap-3">
    {pilots.map(pilot => <button key={pilot} type="button" className={`btn ${pilot === "jev" ? "btn-primary" : ""}`} disabled={!!running || !health[pilot].ok} onClick={() => onRun(pilot, ids)}>Medir {PILOT_LABEL[pilot]}</button>)}
    {running && <>
      <span className="metric text-sm text-muted" role="status">{running.pilot}: {running.done}/{running.total}</span>
      <div className="h-1.5 w-36 max-w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={running.total} aria-valuenow={running.done}><div className="h-full bg-accent-hi" style={{ width: `${running.total ? running.done / running.total * 100 : 0}%` }} /></div>
      <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
    </>}
    {pilots.filter(pilot => !health[pilot].ok).map(pilot => <span key={pilot} className="min-w-0 text-xs wrap-break-word text-warn">{PILOT_LABEL[pilot]}: {health[pilot].detail}</span>)}
  </div>;
}

export function CascadaBench() {
  const reduce = useReducedMotion();
  const [thresholdA, setA] = useState(.75);
  const [thresholdB, setB] = useState(.75);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [first, setFirst] = useState<FirstPilot>("laya");
  const label = PILOT_LABEL[first];
  const run = useCascadaRun(first, thresholdA, thresholdB);
  const total = run.items.length;
  const reveal = useReveal(total, reduce, 70);
  const visible: CascadaTicket[] = useMemo(() => run.items.slice(0, reveal.shown), [run.items, reveal.shown]);
  const incoming = Math.max(0, total - reveal.shown);
  const visibleStations = stationStats(visible);
  const active = visible.find(item => item.ticket.id === selectedId) ?? visible.at(-1) ?? null;
  const controls = [{ label: `A · pasar de ${label} a Jev`, value: thresholdA, set: setA }, { label: "B · pasar de Jev a persona", value: thresholdB, set: setB }];
  const readyLabel = (n: number) => run.ready ? n : "…";

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <section className="panel min-w-0 overflow-hidden p-6">
        <p className="eyebrow">60 tickets / escalado por confianza</p>
        <h2 className="mt-2 text-2xl font-semibold">{label} → Jev → revisión humana</h2>
        <p className="mt-2 text-sm text-muted">Se reutilizan las pasadas completas de Bandeja. Mover A o B recalcula aquí, sin llamadas nuevas. Solo se escala el departamento; urgencia y baja viajan en la misma llamada. El coste y la latencia son la suma de esas pasadas por separado.</p>
        <div className="mt-5 flex min-w-0 flex-wrap items-center gap-2 text-sm"><span className="text-muted">Primer escalón</span>
          <div className="flex min-w-0 rounded-md border border-line p-1" role="tablist" aria-label="Primer escalón">
            {FIRST_PILOTS.map(id => <button key={id} type="button" role="tab" aria-selected={first === id} className={`rounded px-3 py-1.5 ${first === id ? "bg-white/10 text-ink" : "text-muted"}`} style={first === id ? { color: PILOT_COLOR[id] } : undefined} onClick={() => { setFirst(id); setSelectedId(null); }}>{PILOT_LABEL[id]}</button>)}
          </div>
        </div>
        <div className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2">{controls.map(control => <label key={control.label} className="min-w-0 text-sm">{control.label} <strong className="metric">{Math.round(control.value * 100)}%</strong><input className="mt-3 w-full min-w-0 accent-[#e0336f]" type="range" min="0" max="100" value={Math.round(control.value * 100)} onChange={event => control.set(Number(event.target.value) / 100)} /></label>)}</div>
        <div className="mt-6"><RunButtons pilots={[first, "jev"]} ids={run.ids} running={run.progress} onRun={run.run} onCancel={run.cancel} /></div>
        {run.error && <p role="alert" className="mt-3 text-sm wrap-break-word text-bad">{run.error}</p>}
        {run.missingJev > 0 && <p className="mt-3 text-sm text-warn">Faltan {run.missingJev} respuestas de Jev por debajo de A. Esos tickets van a revisión.</p>}
        {total > 0 && (
          <div className="mt-5 flex min-w-0 flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => { setSelectedId(null); reveal.replay(); }}><Play size={16} /> Reproducir flujo</button>
            {reveal.playing && <button type="button" className="btn" onClick={reveal.pause}><Pause size={16} /> Pausar</button>}
            {reveal.shown < total && <button type="button" className="btn" onClick={reveal.skip}>Saltar al final</button>}
          </div>
        )}
      </section>

      {!run.ready ? (
        <section className="panel p-6" aria-busy="true">
          <p className="text-sm text-muted">Cargando las pasadas de Bandeja…</p>
        </section>
      ) : run.firstReady === 0 ? (
        <section className="panel min-w-0 overflow-hidden p-6">
          <p className="eyebrow">{run.jevReady ? `Falta ${label}` : "Sin pasadas de Bandeja"}</p>
          <h3 className="mt-2 text-xl font-semibold">{run.jevReady ? `Jev está listo; el embudo necesita ${label}` : "No hay fichas que hacer circular"}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            {run.jevReady
              ? `Hay una pasada de Jev guardada, pero Cascada solo reparte tickets cuando ${label} ya respondió el departamento. Mide ${label} aquí o en Bandeja.`
              : `Cascada no vuelve a preguntar a los modelos: reparte en el navegador las respuestas de departamento que ya guardó Bandeja. Sin una pasada de ${label} no hay umbral que aplicar.`}
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>Abre <Link href="/bandeja" className="text-ink underline decoration-accent-hi/60 underline-offset-2">Bandeja</Link> y pulsa <strong className="text-ink">Medir {label}</strong>. Eso rellena las 60 fichas.</li>
            <li>Mide también <strong className="text-ink">Jev</strong> si quieres que los tickets por debajo de A viajen a la segunda estación en vez de saltar al humano.</li>
            <li>O usa los botones de esta página: guardan la misma pasada en este navegador.</li>
          </ol>
          <p className="mt-4 text-sm text-muted">{label}: {readyLabel(run.firstReady)} / 60 · Jev: {readyLabel(run.jevReady)} / 60.</p>
          <Link href="/bandeja" className="btn btn-primary mt-5">Ir a Bandeja <ArrowRight size={16} /></Link>
        </section>
      ) : (
        <>
          {run.firstReady < 60 && <p className="text-sm text-warn">Pasada parcial: {run.firstReady} de 60 tickets de {label}. Las fichas que faltan no entran en el embudo.</p>}
          <CascadeVerdict first={first} items={run.items} summary={run.summary} thresholdA={thresholdA} thresholdB={thresholdB} />
          <CascadeStations first={first} items={visible} stations={visibleStations} selectedId={active?.ticket.id ?? null} onSelect={setSelectedId} incoming={incoming} />
          <TicketDetail first={first} item={active} thresholdA={thresholdA} thresholdB={thresholdB} />
          <CascadeReport
            first={first}
            items={run.items}
            summary={run.summary}
            failures={run.failures}
            jevRows={run.jevRows}
            jevOnlyCost={run.jevOnlyCost}
            jevOnlyLatency={run.jevOnlyLatency}
            baselineAccuracy={run.baselineAccuracy}
            onSelect={setSelectedId}
          />
        </>
      )}
    </div>
  );
}
