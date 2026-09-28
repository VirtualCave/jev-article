"use client";

import { ArrowCounterClockwise, Pause, Play } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHealth } from "@/hooks/useHealth";
import { addHistory } from "@/lib/history";
import { formatMs, formatUsd } from "@/lib/ai/pricing";
import type { MatchStatus, PlayerKind, Side } from "@/lib/tetris/types";
import { WellPanel, type WellProgress } from "./WellPanel";

function nextSeed() { return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0; }
const empty = { left: null, right: null } as Record<Side, WellProgress | null>;

export function Arena() {
  const reduce = useReducedMotion();
  const health = useHealth();
  const [seed, setSeed] = useState(0);
  const [match, setMatch] = useState<MatchStatus>("idle");
  const [left, setLeft] = useState<PlayerKind>("jev");
  const [right, setRight] = useState<PlayerKind>("laya");
  const [progress, setProgress] = useState(empty);
  const recorded = useRef<number | null>(null);
  const onProgress = useCallback((side: Side, next: WellProgress) => setProgress(prev => {
    const before = prev[side];
    if (before && Object.keys(next).every(key => before[key as keyof WellProgress] === next[key as keyof WellProgress])) return prev;
    return { ...prev, [side]: next };
  }), []);

  const a = progress.left, b = progress.right;
  const finished = match !== "idle" && a && b && ((a.status === "over" && b.status === "over") || (a.status === "over" && b.pieceIndex >= a.pieceIndex + 3) || (b.status === "over" && a.pieceIndex >= b.pieceIndex + 3));
  const winner = a && b ? a.score === b.score ? "Empate" : a.score > b.score ? "Pozo izquierdo" : "Pozo derecho" : "";
  useEffect(() => {
    if (!finished || !a || !b || recorded.current === seed) return;
    recorded.current = seed;
    setMatch("paused");
    addHistory({ kind: "tetris", label: `${winner}: ${a.score}–${b.score}`, detail: `${a.lines + b.lines} líneas · ${formatUsd(a.costUsd + b.costUsd)}` });
  }, [finished, seed, a, b, winner, left, right]);

  const onPrimary = () => {
    if (match === "idle") { if ((left === "jev" && !health.jev.ok) || (left === "laya" && !health.laya.ok) || (right === "jev" && !health.jev.ok) || (right === "laya" && !health.laya.ok)) return; setProgress(empty); setSeed(nextSeed()); setMatch("running"); }
    else setMatch(current => current === "running" ? "paused" : "running");
  };
  const onReset = () => { setMatch("idle"); setProgress(empty); setSeed(nextSeed()); };
  const bothHuman = left === "human" && right === "human";
  const availability = { jev: health.jev.ok, laya: health.laya.ok };

  return <div>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div><p className="eyebrow">Dos pozos / misma semilla</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">La misma secuencia. Dos decisiones.</h2><p className="mt-2 text-sm text-muted">El pozo espera al modelo; se mide el tiempo de decisión.</p></div>
      <div className="flex gap-2"><button className="btn btn-primary" onClick={onPrimary} disabled={Boolean(finished) || (left !== "human" && !health[left].ok) || (right !== "human" && !health[right].ok)}>{match === "running" ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}{match === "running" ? "Pausa" : match === "paused" ? "Seguir" : "Empezar"}</button><button className="btn" onClick={onReset}><ArrowCounterClockwise size={16} />Reiniciar</button></div>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <motion.div initial={reduce ? false : { opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} className="panel p-5 sm:p-7"><WellPanel key={`left-${seed}`} side="left" player={left} onPlayer={setLeft} seed={seed} match={match} bothHuman={bothHuman} healthDetail={left === "jev" ? health.jev.detail : health.laya.detail} availability={availability} onProgress={onProgress} /></motion.div>
      <motion.div initial={reduce ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} className="panel p-5 sm:p-7"><WellPanel key={`right-${seed}`} side="right" player={right} onPlayer={setRight} seed={seed} match={match} bothHuman={bothHuman} healthDetail={right === "jev" ? health.jev.detail : health.laya.detail} availability={availability} onProgress={onProgress} /></motion.div>
    </div>
    {finished && a && b && <motion.section initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="panel mt-5 grid gap-6 p-6 sm:grid-cols-[1fr_2fr] sm:p-8" aria-live="polite"><div><p className="eyebrow">Resultado de la partida</p><h3 className="mt-2 text-3xl font-semibold tracking-tight">{winner}</h3><p className="mt-2 text-sm text-muted">{a.score} — {b.score} puntos</p></div><dl className="grid grid-cols-2 gap-5 sm:grid-cols-4"><ResultStat label="Líneas" value={String(a.lines + b.lines)} /><ResultStat label="Coste Jev" value={formatUsd(a.costUsd + b.costUsd)} /><ResultStat label="Decisión media" value={formatMs((a.decideMs + b.decideMs) / Math.max(1, a.decisions + b.decisions))} /><ResultStat label="Latencia media" value={formatMs((a.latencyMs + b.latencyMs) / Math.max(1, a.decisions + b.decisions))} /></dl></motion.section>}
  </div>;
}

function ResultStat({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted">{label}</dt><dd className="metric mt-2 text-xl">{value}</dd></div>; }
