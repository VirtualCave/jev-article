"use client";

import { CaretDown, CheckCircle, Copy, WarningCircle } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { formatMs, formatUsd } from "@/lib/ai/pricing";
import type { Verdict } from "@/lib/strawberry/aggregate";
import { MODE_BAR, MODE_META, MODES } from "@/lib/strawberry/modes";
import type { BenchResult, Mode } from "@/lib/strawberry/types";

type ChartRow = { mode: Mode; value: number; min: number; max: number; p25: number; p75: number; best: boolean; tied: boolean; total: number; label?: string };

function hasSpread(min: number, max: number, total: number) {
  return total >= 2 && max - min >= 1;
}

function MetricChart({ title, caption, unit, rows, format, higherIsBetter }: { title: string; caption: string; unit: string; rows: ChartRow[]; format: (value: number) => string; higherIsBetter?: boolean }) {
  const reduce = useReducedMotion();
  const ceiling = Math.max(...rows.map(row => Math.max(row.value, row.max)), 1);
  return <figure className="min-w-0">
    <figcaption className="text-sm font-medium text-ink">{title}</figcaption>
    <p className="mt-1 text-xs text-muted">{caption} {higherIsBetter ? "Más alto es mejor." : "Más bajo es mejor."}</p>
    <ul className="mt-4 space-y-3" aria-label={`${title} en ${unit}`}>
      {rows.map(row => {
        const medianPct = row.value <= 0 ? 0 : Math.max(1.2, row.value / ceiling * 100);
        const minPct = row.min / ceiling * 100;
        const maxPct = row.max / ceiling * 100;
        const p25Pct = row.p25 / ceiling * 100;
        const p75Pct = row.p75 / ceiling * 100;
        const spread = hasSpread(row.min, row.max, row.total);
        const rangeWidth = Math.max(0, maxPct - minPct);
        const iqrWidth = Math.max(0, p75Pct - p25Pct);
        const shown = row.label ?? format(row.value);
        return <li key={row.mode} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(9rem,14rem)_1fr_auto] sm:gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-sm ${MODE_BAR[row.mode]}`} aria-hidden="true" />
            <span className="text-sm leading-snug text-muted">{MODE_META[row.mode].title}</span>
          </div>
          <div className="relative h-7 overflow-hidden rounded-sm bg-white/5" role="meter" aria-valuemin={0} aria-valuemax={ceiling} aria-valuenow={row.value} aria-label={`${MODE_META[row.mode].title}: ${shown}`}>
            <motion.span
              className={`absolute inset-y-0 left-0 rounded-sm ${MODE_BAR[row.mode]} ${row.best ? "opacity-100" : "opacity-55"}`}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: `${medianPct}%`, transformOrigin: "left" }}
            />
            {spread && <>
              <span className="absolute top-1/2 h-px -translate-y-1/2 bg-ink/70" style={{ left: `${minPct}%`, width: `${rangeWidth}%` }} />
              <span className="absolute top-1.5 bottom-1.5 bg-ink/25" style={{ left: `${p25Pct}%`, width: `${iqrWidth}%` }} />
              <span className="absolute top-1 bottom-1 w-0.5 bg-ink" style={{ left: `calc(${Math.min(99, medianPct)}% - 1px)` }} />
            </>}
          </div>
          <p className="metric flex items-baseline justify-end gap-2 text-sm text-ink">
            <span>{shown}</span>
            {row.best && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ok"><CheckCircle size={14} weight="fill" />{row.tied ? "Empate" : "Mejor"}</span>}
          </p>
          {spread && <p className="metric text-[11px] text-faint sm:col-start-2">mín {format(row.min)} · máx {format(row.max)}{row.p25 !== row.min || row.p75 !== row.max ? ` · p25 ${format(row.p25)} · p75 ${format(row.p75)}` : ""}</p>}
        </li>;
      })}
    </ul>
  </figure>;
}

export function ResultsPanel({ samples, verdict, rounds, copied, onCopy }: { samples: Record<Mode, BenchResult[]>; verdict: Verdict; rounds: number; copied: boolean; onCopy: () => void }) {
  const reduce = useReducedMotion();
  const { stats, fastest, cheapest, mostAccurate } = verdict;
  const timeRows: ChartRow[] = MODES.map(mode => ({ mode, value: stats[mode].medianMs, min: stats[mode].minMs, max: stats[mode].maxMs, p25: stats[mode].p25Ms, p75: stats[mode].p75Ms, best: fastest.includes(mode), tied: fastest.length > 1, total: stats[mode].total }));
  const tokenRows: ChartRow[] = MODES.map(mode => ({ mode, value: stats[mode].medianTokens, min: stats[mode].minTokens, max: stats[mode].maxTokens, p25: stats[mode].p25Tokens, p75: stats[mode].p75Tokens, best: cheapest.includes(mode), tied: cheapest.length > 1, total: stats[mode].total }));
  const accuracyRows: ChartRow[] = MODES.map(mode => ({ mode, value: stats[mode].accuracy, min: stats[mode].accuracy, max: stats[mode].accuracy, p25: stats[mode].accuracy, p75: stats[mode].accuracy, best: mostAccurate.includes(mode), tied: mostAccurate.length > 1, total: stats[mode].total, label: `${stats[mode].correct}/${stats[mode].total}` }));
  const word = samples.single[0]?.word;
  const letter = samples.single[0]?.letter;
  const model = samples.single[0]?.model;

  return <motion.section initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="panel mt-5 p-5 sm:p-8" aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow">Medianas de {rounds} {rounds === 1 ? "ronda" : "rondas"}{model ? ` · ${model}` : ""}</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Resultado de las tres estrategias</h2>
      </div>
      <button type="button" className="btn shrink-0" onClick={onCopy}><Copy size={16} />{copied ? "Copiado" : "Copiar JSON"}</button>
    </div>
    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink sm:text-base">{verdict.headline}</p>

    {(verdict.warnings.length > 0 || verdict.notes.length > 0) && <div className="mt-6 space-y-3">
      {verdict.warnings.map(text => <p key={text} role="status" className="flex gap-2 border-l-2 border-warn pl-3 text-sm leading-relaxed text-ink"><WarningCircle size={16} className="mt-0.5 shrink-0 text-warn" />{text}</p>)}
      {verdict.notes.map(text => <p key={text} className="border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">{text}</p>)}
    </div>}

    <ol className="mt-8 space-y-5 border-t border-line pt-6">
      {MODES.map(mode => <li key={mode}>
        <p className="metric text-xs text-accent-hi">{MODE_META[mode].number} {MODE_META[mode].title}</p>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{MODE_META[mode].why}</p>
      </li>)}
    </ol>

    <div className="mt-8 space-y-8 border-t border-line pt-6">
      <MetricChart title="Tiempo" caption="Barra a la mediana. Línea: mínimo a máximo; bloque: p25 a p75, si hay varias rondas." unit="ms" rows={timeRows} format={formatMs} />
      <MetricChart title="Tokens de entrada" caption="Mediana de tokens facturados por estrategia. En N consultas se suman las N llamadas." unit="tokens" rows={tokenRows} format={value => `${Math.round(value)} tok`} />
      <MetricChart title="Acierto" caption="Rondas en las que el recuento coincidió con la verdad." unit="%" rows={accuracyRows} format={value => `${Math.round(value * 100)}%`} higherIsBetter />
    </div>

    <details className="mt-8 border-t border-line pt-5 open:[&_svg]:rotate-180">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        <CaretDown size={16} className="text-muted transition-transform" />
        Números de cada ronda
      </summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-max min-w-full text-left text-sm">
          <caption className="sr-only">Medianas y percentiles por estrategia{word && letter ? ` para ${word} / ${letter}` : ""}</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2 pr-4 font-medium">Estrategia</th>
              <th className="py-2 pr-4 font-medium">Tiempo</th>
              <th className="py-2 pr-4 font-medium">Tokens</th>
              <th className="py-2 pr-4 font-medium">Coste</th>
              <th className="py-2 font-medium">Acierto</th>
            </tr>
          </thead>
          <tbody>
            {MODES.map(mode => {
              const row = stats[mode];
              return <tr key={mode} className="border-b border-line/80 align-top">
                <td className="py-2.5 pr-4 text-ink">{MODE_META[mode].title}</td>
                <td className="metric whitespace-nowrap py-2.5 pr-4">{formatMs(row.medianMs)}{row.total > 1 && <span className="mt-1 block text-[11px] text-faint">p25 {formatMs(row.p25Ms)} · p75 {formatMs(row.p75Ms)} · mín {formatMs(row.minMs)} · máx {formatMs(row.maxMs)}</span>}</td>
                <td className="metric whitespace-nowrap py-2.5 pr-4">{Math.round(row.medianTokens)}<span className="mt-1 block text-[11px] text-faint">media {Math.round(row.meanTokens)}</span></td>
                <td className="metric whitespace-nowrap py-2.5 pr-4">{formatUsd(row.meanCostUsd)}</td>
                <td className="metric whitespace-nowrap py-2.5">{row.correct}/{row.total}</td>
              </tr>;
            })}
          </tbody>
        </table>
        <table className="mt-6 w-max min-w-full text-left text-sm">
          <caption className="mb-2 text-left text-xs text-muted">Cada ronda rota el orden de las tres estrategias. Valores crudos por muestra.</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Ronda</th>
              <th className="py-2 pr-3 font-medium">Estrategia</th>
              <th className="py-2 pr-3 font-medium">Tiempo</th>
              <th className="py-2 pr-3 font-medium">Tokens</th>
              <th className="py-2 pr-3 font-medium">Recuento</th>
              <th className="py-2 font-medium">Acierto</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rounds }, (_, index) => MODES.map(mode => {
              const sample = samples[mode][index];
              if (!sample) return null;
              return <tr key={`${mode}-${index}`} className="border-b border-line/60">
                <td className="metric whitespace-nowrap py-2 pr-3 text-muted">{index + 1}</td>
                <td className="whitespace-nowrap py-2 pr-3">{MODE_META[mode].title}</td>
                <td className="metric whitespace-nowrap py-2 pr-3">{formatMs(sample.wallMs)}</td>
                <td className="metric whitespace-nowrap py-2 pr-3">{sample.usage.inputTokens}</td>
                <td className="metric whitespace-nowrap py-2 pr-3">{sample.count} / {sample.truth}</td>
                <td className={`metric whitespace-nowrap py-2 ${sample.correct ? "text-ok" : "text-bad"}`}>{sample.correct ? "sí" : "no"}</td>
              </tr>;
            }))}
          </tbody>
        </table>
      </div>
    </details>
  </motion.section>;
}
