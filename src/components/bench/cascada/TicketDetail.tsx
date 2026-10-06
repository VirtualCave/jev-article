"use client";

import { motion, useReducedMotion } from "motion/react";
import { DEPT_LABEL, type CascadaTicket, type FirstPilot } from "@/hooks/useCascadaRun";
import { PILOT_COLOR, PILOT_LABEL } from "@/lib/ai/pilots";

function Bar({ value, threshold, color }: { value: number; threshold: number; color: string }) {
  const pass = value >= threshold;
  return (
    <div className="relative mt-2 h-2 rounded-full bg-white/10">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color }}
        initial={false}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      />
      <span className={`absolute top-1/2 h-4 w-0.5 -translate-y-1/2 ${pass ? "bg-ok" : "bg-warn"}`} style={{ left: `${Math.round(threshold * 100)}%` }} />
    </div>
  );
}

export function TicketDetail({ first, item, thresholdA, thresholdB }: { first: FirstPilot; item: CascadaTicket | null; thresholdA: number; thresholdB: number }) {
  const label = PILOT_LABEL[first];
  const reduce = useReducedMotion();
  if (!item) {
    return <section className="panel p-6 text-sm text-muted">Pulsa una ficha para leer el ticket, la confianza de cada modelo y por qué escaló o se quedó.</section>;
  }
  const n = item.ticket.id.replace("ticket-", "");
  const firstDept = DEPT_LABEL[String(item.first.predicted)] ?? String(item.first.predicted);
  const jevDept = item.jev ? DEPT_LABEL[String(item.jev.predicted)] ?? String(item.jev.predicted) : null;
  return (
    <motion.section
      key={item.ticket.id}
      className="panel min-w-0 overflow-hidden p-6"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="eyebrow">Ticket {n} · verdad {DEPT_LABEL[item.ticket.department]}</p>
      <blockquote className="mt-3 rounded-lg border border-line bg-white/3 p-4 text-base leading-relaxed wrap-break-word">{item.ticket.text}</blockquote>
      <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{label}</p>
          <p className="metric mt-1 text-lg">{firstDept} · {Math.round(item.first.confidence * 100)}%</p>
          <Bar value={item.first.confidence} threshold={thresholdA} color={PILOT_COLOR[first]} />
          <p className={`mt-2 text-xs ${item.first.confidence >= thresholdA ? "text-ok" : "text-warn"}`}>
            {item.first.confidence >= thresholdA ? `≥ umbral A · se queda${item.firstCorrect ? " y acierta" : " y falla"}` : "< umbral A · viaja a Jev"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted">Jev</p>
          {item.jev ? (
            <>
              <p className="metric mt-1 text-lg">{jevDept} · {Math.round(item.jev.confidence * 100)}%</p>
              <Bar value={item.jev.confidence} threshold={thresholdB} color="var(--accent-hi)" />
              <p className={`mt-2 text-xs ${item.station === "first" ? "text-muted" : item.jev.confidence >= thresholdB ? "text-ok" : "text-warn"}`}>
                {item.station === "first" ? `No se consulta: ${label} ya resolvió.` : item.jev.confidence >= thresholdB ? `≥ umbral B · se queda${item.jevCorrect ? " y acierta" : " y falla"}` : "< umbral B · va a una persona"}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">{item.station === "first" ? `No hace falta: ${label} se quedó el ticket.` : "No hay respuesta de Jev en la pasada de Bandeja."}</p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted">Humano</p>
          <p className="metric mt-1 text-lg">{item.station === "human" ? "Revisa" : "No interviene"}</p>
          <p className="mt-2 text-xs text-muted">{item.station === "human" ? "Se estima acierto perfecto. Tiempo y coste no se incluyen." : "La cascada cortó antes."}</p>
        </div>
      </div>
      <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed">{item.why}{item.mix && item.station !== "human" && !item.finalCorrect ? ` ${item.mix.charAt(0).toUpperCase()}${item.mix.slice(1)}.` : ""}</p>
    </motion.section>
  );
}
