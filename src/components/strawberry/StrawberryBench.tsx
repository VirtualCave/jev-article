"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResultsPanel } from "@/components/strawberry/ResultsPanel";
import { useHealth } from "@/hooks/useHealth";
import { formatMs, formatUsd } from "@/lib/ai/pricing";
import { addHistory } from "@/lib/history";
import { buildVerdict, summarize } from "@/lib/strawberry/aggregate";
import { normalizeInput } from "@/lib/strawberry/input";
import { MODE_META, MODES } from "@/lib/strawberry/modes";
import type { BenchError, BenchResult, Mode } from "@/lib/strawberry/types";

const EMPTY = { single: [], batch: [], fanout: [] } as Record<Mode, BenchResult[]>;
/** Checked against jev-1.13: the single count query misses the first four, and gets strawberry right. */
const PRESETS = [["raspberry", "r"], ["bookkeeper", "e"], ["parallel", "l"], ["bubblegum", "b"], ["strawberry", "r"]] as const;

export function StrawberryBench() {
  const health = useHealth();
  const reduce = useReducedMotion();
  const [word, setWord] = useState("raspberry");
  const [letter, setLetter] = useState("r");
  const [rounds, setRounds] = useState(3);
  const [samples, setSamples] = useState<Record<Mode, BenchResult[]>>(EMPTY);
  const [active, setActive] = useState<Mode | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);
  const [replay, setReplay] = useState<Set<number>>(new Set());
  const [compressed, setCompressed] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);
  const liveStart = useRef(0);
  const input = normalizeInput(word, letter);
  const latest = Object.fromEntries(MODES.map(mode => [mode, samples[mode].at(-1)])) as Record<Mode, BenchResult | undefined>;
  const complete = MODES.every(mode => samples[mode].length === rounds && rounds > 0);
  const verdict = useMemo(() => complete ? buildVerdict(samples) : null, [complete, samples]);
  const ratio = verdict ? verdict.stats.batch.medianMs / Math.max(1, verdict.stats.single.medianMs) : null;

  useEffect(() => () => { abortRef.current?.abort(); timers.current.forEach(clearTimeout); }, []);
  useEffect(() => {
    if (!active) return;
    liveStart.current = performance.now();
    const id = window.setInterval(() => setClock(performance.now() - liveStart.current), 50);
    return () => window.clearInterval(id);
  }, [active]);

  const run = async () => {
    if (!input || busy) return;
    const controller = new AbortController(); abortRef.current = controller;
    timers.current.forEach(clearTimeout); timers.current = [];
    setSamples({ single: [], batch: [], fanout: [] }); setReplay(new Set()); setError(""); setCopied(false); setBusy(true); setRound(0);
    const collected = { single: [], batch: [], fanout: [] } as Record<Mode, BenchResult[]>;
    const ask = async (mode: Mode | "warmup") => {
      const response = await fetch("/api/strawberry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, ...input }), signal: controller.signal });
      const data = await response.json() as BenchResult | BenchError;
      if (!data.ok) throw new Error(data.error);
      return data as BenchResult;
    };
    try {
      await ask("warmup");
      for (let r = 0; r < rounds; r++) {
        setRound(r + 1);
        for (let offset = 0; offset < 3; offset++) {
          const mode = MODES[(r + offset) % 3];
          setActive(mode); setClock(0);
          const result = await ask(mode);
          collected[mode] = [...collected[mode], result];
          setSamples({ single: [...collected.single], batch: [...collected.batch], fanout: [...collected.fanout] });
          setActive(null);
          if (mode === "fanout" && result.calls.length) {
            const scale = Math.min(1, 3000 / result.wallMs);
            setCompressed(scale < 1); setReplay(new Set());
            if (reduce) setReplay(new Set(result.calls.map((_, i) => i)));
            else {
              result.calls.forEach((call, i) => { timers.current.push(window.setTimeout(() => setReplay(prev => new Set(prev).add(i)), call.endMs * scale)); });
              await new Promise<void>(resolve => { timers.current.push(window.setTimeout(resolve, result.wallMs * scale + 80)); });
            }
          }
        }
      }
      const single = summarize(collected.single), batch = summarize(collected.batch);
      addHistory({ kind: "strawberry", label: `${input.word} / ${input.letter}`, detail: `${(batch.medianMs / Math.max(1, single.medianMs)).toFixed(2)}× · ${rounds} rondas` });
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "El benchmark se interrumpió."); }
    finally { setActive(null); setBusy(false); abortRef.current = null; }
  };

  const exportData = useMemo(() => ({ word: input?.word, letter: input?.letter, rounds, samples, ratio, headline: verdict?.headline, generatedAt: new Date().toISOString() }), [input?.word, input?.letter, rounds, samples, ratio, verdict?.headline]);
  const copy = async () => { await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2)); setCopied(true); };

  return <div>
    <section className="panel overflow-hidden p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">La palabra bajo el microscopio</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">¿Cuántas veces aparece la letra?</h2></div><span className="metric rounded-md border border-line px-3 py-1.5 text-xs text-muted">JEV / SYSTEM ONE</span></div>
      <WordTiles word={input?.word || word.toLowerCase().slice(0, 24)} letter={input?.letter || letter} />
      <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
        <label className="text-xs text-muted">Palabra<input className="input mt-2" value={word} maxLength={24} disabled={busy} onChange={event => setWord(event.target.value)} aria-invalid={!input} /></label>
        <label className="text-xs text-muted">Letra<input className="input mt-2" value={letter} maxLength={1} disabled={busy} onChange={event => setLetter(event.target.value)} aria-invalid={!input} /></label>
        <label className="text-xs text-muted">Rondas<select className="input mt-2" value={rounds} disabled={busy} onChange={event => setRounds(Number(event.target.value))}><option value={1}>1</option><option value={3}>3</option><option value={5}>5</option></select></label>
        <button className="btn btn-primary" disabled={!input || busy || !health.jev.ok} onClick={run}>{busy ? `Ronda ${round}/${rounds}` : "Ejecutar benchmark"}</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">Probar con:{PRESETS.map(([w, l]) => <button key={w} type="button" disabled={busy} onClick={() => { setWord(w); setLetter(l); }} className={`metric rounded-md border px-2.5 py-1 ${input?.word === w && input.letter === l ? "border-accent-hi text-ink" : "border-line hover:text-ink"}`}>{w} / {l}</button>)}</div>
      <p className="mt-2 text-xs text-muted">Con jev-1.13 la consulta única falla raspberry, bookkeeper, parallel y bubblegum, y acierta strawberry. Las N consultas simultáneas aciertan las cinco.</p>
      {!input && <p role="alert" className="mt-3 text-sm text-bad">Escribe una palabra de 1–24 letras y una sola letra objetivo.</p>}
      {!health.jev.ok && <p className="mt-3 text-sm text-warn">{health.jev.detail}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
      <p className="mt-4 text-xs text-muted">Cada ronda rota el orden de los tres carriles. Las peticiones de un carril terminan antes de empezar el siguiente.</p>
    </section>

    <div className="mt-5 grid gap-4 lg:grid-cols-3" aria-live="polite">{MODES.map(mode => <LaneCard key={mode} mode={mode} samples={samples[mode]} active={active === mode} clock={clock} word={input?.word || word} letter={input?.letter || letter} replay={replay} compressed={compressed} />)}</div>

    <Waterfall latest={latest} />

    {complete && verdict && <ResultsPanel samples={samples} verdict={verdict} rounds={rounds} copied={copied} onCopy={copy} />}
  </div>;
}

function WordTiles({ word, letter, active, result, replay, mode, compact = false }: { word: string; letter: string; active?: boolean; result?: BenchResult; replay?: Set<number>; mode?: Mode; compact?: boolean }) {
  const reduce = useReducedMotion();
  return <div className="mt-6 flex max-w-full flex-wrap gap-1.5">{[...word].map((char, index) => {
    const answered = mode === "fanout" && result ? replay?.has(index) : Boolean(result?.perLetter);
    const lit = mode === "fanout" && result ? answered && result.perLetter?.[index]?.isTarget : result?.perLetter?.[index]?.isTarget;
    return <motion.span key={`${index}-${char}`} layout animate={reduce ? undefined : { rotateX: lit ? 360 : 0 }} className={`word-tile ${compact ? "compact" : ""} ${lit ? "hit" : ""} ${answered ? "answered" : ""} ${active && mode === "batch" ? "pending" : ""} ${active && mode === "single" ? "scan" : ""}`} style={active && mode === "single" ? { animationDelay: `${index * 90}ms` } : undefined} aria-label={`Posición ${index + 1}: ${char}${lit ? `, coincide con ${letter}` : ""}`}>{char}</motion.span>;
  })}</div>;
}

function AnimatedNumber({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const target = useMotionValue(0);
  const spring = useSpring(target, { stiffness: 180, damping: 25 });
  const label = useTransform(spring, number => Math.round(number).toString());
  useEffect(() => { target.set(value); }, [target, value]);
  return reduce ? <>{value}</> : <motion.span>{label}</motion.span>;
}

function LaneCard({ mode, samples, active, clock, word, letter, replay, compressed }: { mode: Mode; samples: BenchResult[]; active: boolean; clock: number; word: string; letter: string; replay: Set<number>; compressed: boolean }) {
  const result = samples.at(-1);
  const summary = samples.length ? summarize(samples) : null;
  return <article className="panel flex min-h-83 flex-col p-5 sm:p-6"><div className="flex items-center justify-between"><span className="eyebrow">{MODE_META[mode].number} / {MODE_META[mode].calls(word.length)}</span><span className={`metric text-xs ${active ? "text-accent-hi" : result ? "text-ok" : "text-faint"}`}>{active ? "CONSULTANDO" : result ? "LISTO" : "EN COLA"}</span></div><h3 className="mt-5 text-xl font-semibold tracking-tight">{MODE_META[mode].title}</h3><p className="mt-1 text-sm text-muted">{MODE_META[mode].blurb}</p><WordTiles word={word} letter={letter} active={active} result={result} replay={replay} mode={mode} compact />{mode === "fanout" && result && <p className="mt-2 text-[11px] text-muted">Reproducción con tiempos reales{compressed ? " (comprimida a 3 s)" : ""}</p>}
    <div className="mt-auto border-t border-line pt-5"><div className="flex items-end justify-between gap-3"><div><span className="text-xs text-muted">{active ? "Tiempo transcurrido" : result ? "Recuento" : "Esperando"}</span><p className="metric mt-1 text-4xl font-medium">{active ? formatMs(clock) : result ? <><AnimatedNumber value={result.count} />{mode === "single" && result.count === 5 ? "+" : ""}</> : "—"}</p></div><div className="text-right"><span className="text-xs text-muted">Mediana</span><p className="metric mt-1 text-lg">{summary ? formatMs(summary.medianMs) : "—"}</p></div></div>{summary && <p className="metric mt-3 text-[11px] text-muted">mín {formatMs(summary.minMs)} · máx {formatMs(summary.maxMs)} · {Math.round(summary.meanTokens)} tok · {formatUsd(summary.meanCostUsd)}</p>}{result?.softCount !== undefined && <p className="mt-2 text-[11px] text-muted">Suma blanda Σnoul: {result.softCount.toFixed(2)}</p>}{result?.probabilities && <div className="mt-3 grid grid-cols-6 gap-1" aria-label="Probabilidades de cada recuento">{Object.entries(result.probabilities).map(([count, value]) => <div key={count} className="text-center"><div className="flex h-7 items-end rounded-sm bg-white/5"><span className="w-full rounded-sm bg-accent" style={{ height: `${Math.max(4, value * 100)}%` }} /></div><span className="metric text-[10px] text-muted">{count}</span></div>)}</div>}</div>
  </article>;
}

function Waterfall({ latest }: { latest: Record<Mode, BenchResult | undefined> }) {
  const available = MODES.filter(mode => latest[mode]);
  if (!available.length) return <section className="panel mt-5 p-6"><p className="eyebrow">Waterfall</p><p className="mt-3 text-sm text-muted">Las barras de tiempo aparecerán tras la primera muestra.</p></section>;
  const max = Math.max(...available.map(mode => latest[mode]!.wallMs), 1);
  return <section className="panel mt-5 p-5 sm:p-8"><div className="mb-6 flex flex-wrap items-baseline justify-between gap-3"><div><p className="eyebrow">Waterfall</p><h2 className="mt-2 text-xl font-semibold">Tiempo por llamada</h2></div><span className="metric text-xs text-muted">0 - {formatMs(max)}</span></div><div className="space-y-5">{MODES.map(mode => { const result = latest[mode]; return <div key={mode} className="grid gap-2 sm:grid-cols-[11.5rem_1fr] sm:items-start"><span className="text-sm text-muted">{MODE_META[mode].title}</span><div className="relative min-h-7 border-l border-r border-white/10 bg-white/3">{result?.calls.map(call => <motion.div key={call.id} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: .5 }} style={{ left: `${call.startMs / max * 100}%`, width: `${Math.max(.5, call.latencyMs / max * 100)}%`, transformOrigin: "left" }} className={`relative rounded-sm ${mode === "single" ? "h-4 bg-accent-hi" : mode === "batch" ? "h-4 bg-laya" : "mb-1 h-2 bg-white/60"}`} title={`${call.label}: ${formatMs(call.latencyMs)}`} />)}{!result && <span className="ml-2 text-xs text-faint">Sin muestra</span>}</div></div>; })}</div><div className="metric mt-4 flex justify-between border-t border-line pt-2 text-[10px] text-faint"><span>0</span><span>{formatMs(max / 4)}</span><span>{formatMs(max / 2)}</span><span>{formatMs(max * .75)}</span><span>{formatMs(max)}</span></div><p className="mt-4 text-xs text-muted">Última muestra de cada carril. Las llamadas del tercer carril se apilan según su inicio y fin reales.</p></section>;
}
