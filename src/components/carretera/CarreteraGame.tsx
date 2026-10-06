"use client";

import { ArrowClockwise, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Shuffle } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useHealth } from "@/hooks/useHealth";
import type { ModelPilot } from "@/lib/ai/pilots";
import { formatMs, formatUsd } from "@/lib/ai/pricing";
import type { BenchResult } from "@/lib/bench/server";
import { describeRoad, IDLE_LIMIT_S, RoadEngine, type EndCause, type RoadAction } from "@/lib/carretera/engine";
import { mapRoadMove } from "@/lib/carretera/policy";
import { RoadView, VIEW_H, VIEW_W, type RecordFlag } from "@/lib/carretera/render";
import { addHistory } from "@/lib/history";

type Pilot = "human" | ModelPilot;
type Run = { pilot: Pilot; seed: number; crossed: number; row: number; cause: EndCause | "stop"; seconds: number; decisions: number; latencyMs: number | null; costUsd: number; at: string };
const PILOTS: { id: Pilot; label: string; color: string }[] = [
  { id: "jev", label: "Jev", color: "#e0336f" },
  { id: "clef", label: "Clef", color: "#f6821f" },
  { id: "clef-flash", label: "Clef-Flash", color: "#46c8e8" },
  { id: "laya", label: "Laya", color: "#9aa5ff" },
  { id: "human", label: "Humano", color: "#f2b544" },
];
const DEFAULT_SEED = 2026;
const RUNS_KEY = "jev-carretera-runs-v2";
const SEED_KEY = "jev-carretera-seed-v2";
const KEY_MOVE: Record<string, RoadAction> = {
  ArrowUp: "advance", KeyW: "advance", Space: "advance",
  ArrowDown: "back", KeyS: "back",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};
const CAUSE: Record<Run["cause"], string> = { hit: "atropellada", idle: `parada ${IDLE_LIMIT_S} s`, stop: "terminada a mano" };
const MOVE_LABEL: Record<RoadAction, string> = { advance: "avanzar", back: "retroceder", wait: "esperar", left: "izquierda", right: "derecha" };

function readRuns(): Run[] {
  try { return JSON.parse(localStorage.getItem(RUNS_KEY) || "[]") as Run[]; } catch { return []; }
}
function readSeed() {
  try { return Number(localStorage.getItem(SEED_KEY)) || DEFAULT_SEED; } catch { return DEFAULT_SEED; }
}

export function CarreteraGame() {
  const health = useHealth();
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef(new RoadEngine());
  const view = useRef(new RoadView());
  const abort = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const lastDecision = useRef(0);
  const paused = useRef(false);
  const failures = useRef(0);
  const pilotRef = useRef<Pilot | null>(null);
  const flagsRef = useRef<RecordFlag[]>([]);
  const latencies = useRef<number[]>([]);
  const cost = useRef(0);
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [runs, setRuns] = useState<Run[]>([]);
  const [ended, setEnded] = useState<Run | null>(null);
  const [isPaused, setPaused] = useState(false);
  const [stats, setStats] = useState({ crossed: 0, elapsed: 0, meanLatency: 0, calls: 0, cost: 0 });
  const [error, setError] = useState("");
  const [seen, setSeen] = useState<{ text: string; safe: number; danger: number; move: RoadAction; ms: number } | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { setRuns(readRuns()); setSeed(readSeed()); });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const best = (id: Pilot) => runs.filter(run => run.pilot === id && run.seed === seed).reduce((top, run) => Math.max(top, run.row), 0);
    flagsRef.current = PILOTS.flatMap(option => {
      const row = best(option.id);
      return row > 1 ? [{ label: `Récord ${option.label}`, row, color: option.color }] : [];
    });
    if (!pilotRef.current && engine.current.seed !== seed) { engine.current.start(seed); engine.current.running = false; view.current.reset(); }
  }, [runs, seed]);

  const finish = (cause: Run["cause"]) => {
    const game = engine.current, who = pilotRef.current;
    abort.current?.abort(); abort.current = null; game.running = false; paused.current = false; setPaused(false);
    pilotRef.current = null; setPilot(null);
    if (!who) return;
    const run: Run = {
      pilot: who, seed: game.seed, crossed: game.crossed, row: game.best, cause, seconds: game.elapsed, decisions: latencies.current.length,
      latencyMs: latencies.current.length ? latencies.current.reduce((a, b) => a + b, 0) / latencies.current.length : null, costUsd: cost.current, at: new Date().toISOString(),
    };
    setEnded(run);
    setRuns(previous => {
      const next = [...previous, run].slice(-200);
      try { localStorage.setItem(RUNS_KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
      return next;
    });
    addHistory({ kind: "carretera", label: `Carretera / ${who}`, detail: `${run.crossed} carriles · ${CAUSE[cause]}` });
  };
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; });

  const start = (selected: Pilot) => {
    abort.current?.abort(); abort.current = new AbortController(); inFlight.current = false; lastDecision.current = 0; failures.current = 0;
    paused.current = false; setPaused(false); latencies.current = []; cost.current = 0; setSeen(null); setError(""); setEnded(null);
    view.current.reset(); engine.current.start(seed);
    pilotRef.current = selected; setPilot(selected);
    canvas.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const newRoad = () => {
    const next = Math.floor(Math.random() * 1_000_000) + 1;
    try { localStorage.setItem(SEED_KEY, String(next)); } catch { /* ignore */ }
    setEnded(null); setSeed(next);
  };
  const togglePause = () => {
    if (!engine.current.running) return;
    paused.current = !paused.current; setPaused(paused.current);
  };
  const hop = (action: RoadAction) => {
    if (pilotRef.current !== "human" || paused.current || !engine.current.running) return;
    engine.current.act(action);
  };

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (["INPUT", "SELECT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
      if (event.code === "KeyP") { togglePause(); return; }
      const action = KEY_MOVE[event.code];
      if (!action || pilotRef.current !== "human" || paused.current) return;
      event.preventDefault();
      engine.current.act(action);
    };
    const onVisibility = () => { if (document.hidden && engine.current.running) { paused.current = true; setPaused(true); } };
    window.addEventListener("keydown", handle);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("keydown", handle); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const fit = () => {
      const rect = node.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      node.width = Math.max(1, Math.round(rect.width * dpr));
      node.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(node.width / VIEW_W, 0, 0, node.height / VIEW_H, 0, 0);
    };
    const observer = new ResizeObserver(fit); observer.observe(node); fit();
    if (!engine.current.rows.length) { engine.current.start(DEFAULT_SEED); engine.current.running = false; }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0, last = 0, lastUi = 0;
    const tick = (now: number) => {
      const game = engine.current;
      const dt = last ? Math.min(.25, (now - last) / 1000) : 0;
      last = now;
      if (!paused.current) game.step(dt);
      if (pilotRef.current && game.over) finishRef.current(game.over);
      view.current.tick(game, dt, reduce);
      view.current.draw(ctx, game, flagsRef.current);
      if (now - lastUi > 100) {
        lastUi = now;
        setStats({
          crossed: game.crossed, elapsed: game.elapsed, calls: latencies.current.length, cost: cost.current,
          meanLatency: latencies.current.length ? latencies.current.reduce((a, b) => a + b, 0) / latencies.current.length : 0,
        });
      }
      const selected = pilotRef.current;
      if (selected && selected !== "human" && !paused.current && !inFlight.current && now - lastDecision.current > 120 && game.running) {
        inFlight.current = true; lastDecision.current = now;
        const facts = game.facts();
        const rowAtDecision = game.row, colAtDecision = game.col;
        const parent = abort.current;
        const request = new AbortController();
        const timeout = window.setTimeout(() => request.abort(), 2000);
        const onAbort = () => request.abort();
        parent?.signal.addEventListener("abort", onAbort, { once: true });
        const started = performance.now();
        void fetch(`/api/decide/carretera/${selected}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ facts }), signal: request.signal }).then(async response => {
          const result = await response.json() as BenchResult;
          if (!result.ok) throw new Error(result.error);
          const ms = performance.now() - started;
          const move = mapRoadMove(result.answers, facts);
          const value = (key: string) => { const answer = result.answers[key]; return answer?.type === "noul" ? answer.noul : 0; };
          setSeen({ text: describeRoad(facts), safe: value("ahead_safe"), danger: value("danger_here"), move, ms });
          latencies.current.push(ms); cost.current += result.usage.costUsd; failures.current = 0;
          // The world kept moving during the call: the model's hop lands on the traffic as it is now.
          if (game.running && !paused.current && game.row === rowAtDecision && game.col === colAtDecision) game.act(move);
        }).catch(cause => {
          if (parent?.signal.aborted) return;
          failures.current++;
          if (failures.current >= 3) { setError(cause instanceof Error ? cause.message : "La decisión falló."); finishRef.current("stop"); }
        }).finally(() => { window.clearTimeout(timeout); parent?.signal.removeEventListener("abort", onAbort); inFlight.current = false; });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); abort.current?.abort(); };
  }, []);

  const onSeed = runs.filter(run => run.seed === seed);
  const board = PILOTS.map(option => {
    const mine = onSeed.filter(run => run.pilot === option.id);
    const best = mine.reduce((top, run) => Math.max(top, run.crossed), 0);
    const last = mine.at(-1) ?? null;
    const mean = mine.length ? mine.reduce((sum, run) => sum + run.crossed, 0) / mine.length : 0;
    const latency = mine.filter(run => run.latencyMs !== null);
    return { ...option, runs: mine, best, last, mean, latency: latency.length ? latency.reduce((sum, run) => sum + (run.latencyMs ?? 0), 0) / latency.length : null };
  });
  const top = Math.max(1, ...board.map(row => row.best));

  return (
    <div className="space-y-4">
      <section className="panel overflow-visible p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Carretera infinita / una vida</p>
            <h2 className="mt-1 text-xl font-semibold">¿Hasta dónde llega cada piloto?</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {PILOTS.map(option => (
              <button key={option.id} type="button" className={`btn ${pilot === option.id ? "border-accent bg-accent text-white" : ""}`} aria-pressed={pilot === option.id} disabled={!!pilot || (option.id !== "human" && !health[option.id].ok)} onClick={() => start(option.id)}>
                {option.label}
              </button>
            ))}
            {pilot && <button type="button" className="btn" onClick={togglePause}>{isPaused ? "Seguir" : "Pausar"}</button>}
            {pilot && <button type="button" className="btn" onClick={() => finish("stop")}>Terminar</button>}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          Todos juegan la misma carretera (semilla <span className="metric text-ink">{seed}</span>). La partida acaba al primer atropello o si la gallina pasa {IDLE_LIMIT_S} s sin avanzar. Cada vez hay más carriles seguidos y el tráfico va más rápido. El modelo lee el carril de delante y el suyo en palabras; su respuesta, y nada más, decide el salto.
        </p>
        <div className="relative mx-auto mt-3 w-full max-w-[calc((100dvh-9rem)*900/560)]">
          <canvas ref={canvas} className="block w-full rounded-lg border border-line" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, background: "#7ec257" }} aria-label="Carretera" role="img" />
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/55 px-3 py-1.5 text-white">
            <p className="metric text-2xl leading-none">{stats.crossed}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/70">carriles</p>
          </div>
          {!pilot && (
            <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/45 p-4 text-center text-white">
              <div>
                {ended ? <>
                  <p className="text-sm text-white/75">{PILOTS.find(option => option.id === ended.pilot)?.label} · {CAUSE[ended.cause]}</p>
                  <p className="metric mt-1 text-5xl">{ended.crossed}</p>
                  <p className="text-sm text-white/75">{ended.crossed === 1 ? "carril cruzado" : "carriles cruzados"} en {ended.seconds.toFixed(1)} s</p>
                  <div className="pointer-events-auto mt-4 flex justify-center gap-2">
                    <button type="button" className="btn btn-primary" disabled={ended.pilot !== "human" && !health[ended.pilot].ok} onClick={() => start(ended.pilot)}><ArrowClockwise size={16} /> Repetir</button>
                  </div>
                </> : <>
                  <p className="text-lg font-semibold">Elige piloto para empezar</p>
                  <p className="mt-1 text-sm text-white/75">Humano: flechas o WASD. Espacio avanza. P pausa.</p>
                </>}
              </div>
            </div>
          )}
        </div>
        {pilot === "human" && (
          <div className="mx-auto mt-4 grid w-[168px] grid-cols-3 gap-1.5" aria-label="Controles">
            <span />
            <Pad label="Adelante" onPress={() => hop("advance")}><ArrowUp size={20} weight="bold" /></Pad>
            <span />
            <Pad label="Izquierda" onPress={() => hop("left")}><ArrowLeft size={20} weight="bold" /></Pad>
            <Pad label="Atrás" onPress={() => hop("back")}><ArrowDown size={20} weight="bold" /></Pad>
            <Pad label="Derecha" onPress={() => hop("right")}><ArrowRight size={20} weight="bold" /></Pad>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
        {seen && (
          <div className="mt-3 rounded-lg border border-line bg-white/3 p-3 text-sm">
            <p className="text-muted"><span className="text-faint">Lee:</span> {seen.text}</p>
            <p className="metric mt-2 text-xs text-muted">seguro avanzar {Math.round(seen.safe * 100)}% · peligro aquí {Math.round(seen.danger * 100)}% → <span className="text-ink">{MOVE_LABEL[seen.move]}</span> · {formatMs(seen.ms)}</p>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">{stats.calls} decisiones · latencia media {stats.calls ? formatMs(stats.meanLatency) : "—"} · {stats.elapsed.toFixed(1)} s · coste Jev {formatUsd(stats.cost)}. Los coches siguen moviéndose mientras el modelo responde.</p>
      </section>

      <section className="panel p-5 sm:p-6" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">Hasta dónde llegan</p>
            <h3 className="mt-1 text-lg font-semibold">Carriles cruzados en esta carretera</h3>
          </div>
          <button type="button" className="btn" disabled={!!pilot} onClick={newRoad}><Shuffle size={16} /> Nueva carretera</button>
        </div>
        <div className="mt-5 space-y-4">
          {board.map(row => (
            <div key={row.id} className="grid gap-2 sm:grid-cols-[6rem_1fr_17rem] sm:items-center sm:gap-4">
              <p className="text-sm font-medium" style={{ color: row.color }}>{row.label}</p>
              <div className="relative h-7 overflow-hidden rounded-md bg-white/6" aria-hidden="true">
                <div className="absolute inset-y-0 left-0 rounded-md opacity-35" style={{ width: `${row.best / top * 100}%`, background: row.color }} />
                <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${row.mean / top * 100}%`, background: row.color }} />
              </div>
              <p className="metric text-sm text-muted sm:text-right">
                {row.runs.length ? <>récord <span className="text-ink">{row.best}</span> · media {row.mean.toFixed(1)} · {row.runs.length} partida{row.runs.length === 1 ? "" : "s"}</> : "sin partidas"}
              </p>
              {row.last && <p className="text-xs text-faint sm:col-start-2 sm:col-end-4">Última: {row.last.crossed} carril{row.last.crossed === 1 ? "" : "es"}, {CAUSE[row.last.cause]} en {row.last.seconds.toFixed(1)} s{row.latency !== null ? ` · latencia media ${formatMs(row.latency)}` : ""}</p>}
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-muted">Barra sólida: media de partidas. Barra clara: récord. Las líneas discontinuas del juego marcan el récord de cada piloto. Cambiar de carretera no borra partidas; solo compara las de la semilla actual.</p>
      </section>
    </div>
  );
}

function Pad({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const last = useRef(0);
  const fire = () => {
    const now = performance.now();
    if (now - last.current < 90) return;
    last.current = now;
    onPress();
  };
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-12 items-center justify-center rounded-lg border border-line bg-surface text-ink active:scale-95"
      onPointerDown={event => { event.preventDefault(); fire(); }}
      onClick={fire}
    >
      {children}
    </button>
  );
}
