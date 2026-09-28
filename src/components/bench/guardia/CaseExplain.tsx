"use client";

import { KIND_LABEL, VERDICT_LABEL, type GuardiaCase } from "@/hooks/useGuardiaRun";

export function CaseExplain({ row }: { row: GuardiaCase | null }) {
  if (!row) {
    return <section className="panel p-6 text-sm text-muted">Elige un prompt en la puerta o en las pilas para ver por qué parece un ataque o por qué coló.</section>;
  }
  return (
    <section className="panel min-w-0 overflow-hidden p-6">
      <p className="eyebrow">{row.blocked ? "Bloqueado" : "Permitido"} · {VERDICT_LABEL[row.verdict]} · {KIND_LABEL[row.item.kind]}</p>
      <blockquote className="mt-3 rounded-lg border border-line bg-white/3 p-4 text-sm leading-relaxed wrap-break-word">{row.item.text}</blockquote>
      <p className="mt-4 text-sm leading-relaxed">{row.why}</p>
      {row.cues.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {row.cues.map(cue => <li key={cue} className="rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-muted">{cue}</li>)}
        </ul>
      )}
    </section>
  );
}
