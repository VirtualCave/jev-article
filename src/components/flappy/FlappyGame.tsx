"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useHealth } from "@/hooks/useHealth";
import { formatMs, formatUsd } from "@/lib/ai/pricing";
import { FlappyEngine, type Decision, type Pilot, W, H } from "@/lib/flappy/engine";
import { renderFlappy } from "@/lib/flappy/render";
import { addHistory } from "@/lib/history";

type Reply = { ok: true; action: "flap" | "glide"; reason: string; latencyMs: number; answers: { relative_to_gap?: { probabilities?: Record<string, number> } }; usage: { input_tokens: number; costUsd?: number }; model: string; state: string } | { ok: false; code: string; error: string };
type View = { status: FlappyEngine["status"]; score: number; n: number; tokens: number; costUsd: number; elapsed: number; flaps: number; avgMs: number; log: Decision[] };
const snapshot = (engine: FlappyEngine): View => ({ status: engine.status, score: engine.score, n: engine.match.n, tokens: engine.match.tokens, costUsd: engine.match.costUsd, elapsed: engine.match.elapsed, flaps: engine.match.flaps, avgMs: engine.match.latencies.reduce((a, b) => a + b, 0) / Math.max(1, engine.match.latencies.length), log: [...engine.match.log] });
const BEST_KEY: Record<Pilot, string> = { human: "flappy-best-human", laya: "flappy-best-laya", jev: "flappy-best-jev" };
const LABEL: Record<Pilot, string> = { human: "Humano", laya: "Laya", jev: "Jev" };

export function FlappyGame() {
  const health = useHealth();
  const healthRef = useRef(health);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [initialEngine] = useState(() => new FlappyEngine());
  const engineRef = useRef(initialEngine);
  const pilotRef = useRef<Pilot>("human");
  const pausedRef = useRef(false);
  const busyRef = useRef(false);
  const closedRef = useRef(false);
  const failuresRef = useRef(0);
  const runIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const bestRef = useRef<Record<Pilot, number>>({ human: 0, laya: 0, jev: 0 });
  const [pilot, setPilot] = useState<Pilot>("human");
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState<Record<Pilot, number>>({ human: 0, laya: 0, jev: 0 });
  const [view, setView] = useState<View>(() => snapshot(initialEngine));
  const [last, setLast] = useState<(Decision & { model: string; tokens: number }) | null>(null);
  const [notice, setNotice] = useState("");
  const [thinking, setThinking] = useState(false);

  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => {
    const loaded = { human: 0, laya: 0, jev: 0 } as Record<Pilot, number>;
    (Object.keys(loaded) as Pilot[]).forEach(key => { loaded[key] = Number(localStorage.getItem(BEST_KEY[key]) || 0); });
    const id = requestAnimationFrame(() => { bestRef.current = loaded; setBest(loaded); });
    return () => cancelAnimationFrame(id);
  }, []);

  const cancelDecision = () => { runIdRef.current++; controllerRef.current?.abort(); controllerRef.current = null; busyRef.current = false; setThinking(false); };
  const available = (next: Pilot) => next === "human" || healthRef.current[next].ok;
  const selectPilot = (next: Pilot) => {
    if (!available(next)) return;
    cancelDecision(); pilotRef.current = next; setPilot(next);
    engineRef.current = new FlappyEngine(); setView(snapshot(engineRef.current));
    setLast(null); setNotice(""); failuresRef.current = 0; closedRef.current = false;
    pausedRef.current = false; setPaused(false);
  };
  const ensureAudio = () => { if (!audioRef.current) audioRef.current = new AudioContext(); if (audioRef.current.state === "suspended") void audioRef.current.resume(); };
  const tone = (frequency: number, duration: number) => {
    const audio = audioRef.current; if (!audio) return;
    try { const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.type = "square"; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.024, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration); } catch { /* sound is optional */ }
  };
  const interact = () => {
    if (pausedRef.current) return;
    ensureAudio();
    const engine = engineRef.current;
    if (engine.status === "ready" || engine.status === "dead") {
      if (!available(pilotRef.current)) { setNotice(pilotRef.current === "human" ? "" : healthRef.current[pilotRef.current].detail); return; }
      cancelDecision(); engine.start(pilotRef.current); setView(snapshot(engine)); setLast(null); setNotice(""); failuresRef.current = 0; closedRef.current = false;
      if (pilotRef.current === "human") { engine.flap(); tone(880, .07); }
    } else if (engine.status === "running" && pilotRef.current === "human") { engine.flap(); tone(880, .07); }
  };
  const togglePause = () => {
    if (engineRef.current.status !== "running") return;
    if (!pausedRef.current) cancelDecision();
    pausedRef.current = !pausedRef.current; setPaused(pausedRef.current);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
      if (event.code === "Digit1") selectPilot("human");
      else if (event.code === "Digit2") selectPilot("laya");
      else if (event.code === "Digit3") selectPilot("jev");
      else if (event.code === "KeyP") togglePause();
      else if (event.code === "Space" || event.code === "ArrowUp") { event.preventDefault(); interact(); }
    };
    window.addEventListener("keydown", onKey);
    const onVisibility = () => { if (document.hidden && engineRef.current.status === "running") { cancelDecision(); pausedRef.current = true; setPaused(true); } };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVisibility); };
  });

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const fit = () => { const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3); canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0); ctx.imageSmoothingEnabled = false; };
    const observer = new ResizeObserver(fit); observer.observe(canvas); fit();
    let raf = 0, previous = 0, published = 0, savedRun = -1, previousScore = 0, previousStatus: FlappyEngine["status"] = "ready";
    const consult = async () => {
      const engine = engineRef.current, currentPilot = pilotRef.current;
      if (busyRef.current || currentPilot === "human" || engine.status !== "running" || closedRef.current || !available(currentPilot)) return;
      busyRef.current = true; setThinking(true);
      const requestRun = runIdRef.current, pipeId = engine.nextPipe()?.id, controller = new AbortController(); controllerRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 2000), started = performance.now();
      try {
        const response = await fetch("/api/flappy/decide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pilot: currentPilot, facts: engine.facts() }), signal: controller.signal });
        const data = await response.json() as Reply;
        if (requestRun !== runIdRef.current || engine !== engineRef.current || engine.status !== "running") return;
        if (!data.ok) throw new Error(data.error);
        failuresRef.current = 0; setNotice("");
        const rttMs = performance.now() - started;
        if (data.action === "flap" && pipeId === engine.nextPipe()?.id && engine.bird.vy > -90 && engine.bird.y > 40) { engine.flap(); tone(880, .07); }
        const decision: Decision = { action: data.action, reason: data.reason, latencyMs: data.latencyMs, rttMs, state: data.state, probabilities: data.answers.relative_to_gap?.probabilities || {} };
        engine.match.n++; engine.match.tokens += data.usage.input_tokens || 0; engine.match.costUsd += data.usage.costUsd || 0; engine.match.latencies.push(data.latencyMs); engine.match.log.unshift(decision); engine.match.log = engine.match.log.slice(0, 8);
        setLast({ ...decision, model: data.model, tokens: data.usage.input_tokens }); setView(snapshot(engine));
      } catch (error) {
        if (requestRun !== runIdRef.current || engine !== engineRef.current || engine.status !== "running") return;
        failuresRef.current++;
        const message = error instanceof Error ? error.message : "El piloto no respondió.";
        setNotice(`${message} (${failuresRef.current}/3 fallos)`);
        if (failuresRef.current >= 3) { closedRef.current = true; setNotice(`${message} Consultas detenidas tras tres fallos. Reinicia la partida.`); }
      } finally {
        window.clearTimeout(timeout);
        if (controllerRef.current === controller) controllerRef.current = null;
        if (requestRun === runIdRef.current) { busyRef.current = false; setThinking(false); }
      }
    };
    const loop = (now: number) => {
      const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0; previous = now;
      const engine = engineRef.current;
      if (!pausedRef.current) engine.step(dt);
      if (engine.score > previousScore) tone(1200, .08);
      previousScore = engine.score;
      if (engine.status === "dying" && previousStatus !== "dying") { cancelDecision(); tone(180, .12); }
      if (engine.status === "dead" && savedRun !== runIdRef.current) {
        savedRun = runIdRef.current;
        const currentPilot = pilotRef.current, currentBest = bestRef.current[currentPilot];
        if (engine.score > currentBest) { const updated = { ...bestRef.current, [currentPilot]: engine.score }; bestRef.current = updated; setBest(updated); localStorage.setItem(BEST_KEY[currentPilot], String(engine.score)); }
        addHistory({ kind: "flappy", label: `${LABEL[currentPilot]} · ${engine.score} tubos`, detail: `${engine.match.n} decisiones · ${engine.match.tokens} tok` });
        setView(snapshot(engine));
      }
      previousStatus = engine.status;
      if (!pausedRef.current && engine.status === "running" && pilotRef.current !== "human" && !busyRef.current) void consult();
      renderFlappy(ctx, engine, now, bestRef.current[pilotRef.current]);
      if (now - published > 125) { published = now; setView(snapshot(engine)); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); controllerRef.current?.abort(); void audioRef.current?.close(); audioRef.current = null; };
  }, []);

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,390px)_1fr]">
    <section className="panel p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Campo de vuelo</p><h2 className="mt-1 text-lg font-semibold">{LABEL[pilot]} al mando</h2></div><span className="metric text-sm text-muted">{view.score} tubos</span></div>
      <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-xl border-2 border-accent/45 shadow-[0_0_40px_rgb(184_20_77_/_0.11)]"><canvas ref={canvasRef} role="button" tabIndex={0} aria-label="Juego Flappy Bird. Toca o pulsa espacio para empezar y aletear." onClick={interact} className="block aspect-[288/512] w-full cursor-pointer" /></div>
      <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Piloto">{(["human", "laya", "jev"] as Pilot[]).map(key => <button key={key} role="radio" aria-checked={pilot === key} title={key === "human" ? "Control manual" : health[key].detail} disabled={key !== "human" && !health[key].ok} onClick={() => selectPilot(key)} className={`btn !px-2 ${pilot === key ? "border-accent bg-accent-soft text-ink" : "text-muted"}`}>{LABEL[key]}</button>)}</div>
      <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted">Espacio / ↑ aletea · 1/2/3 piloto · P pausa</p><button className="btn !min-h-9 !px-3" disabled={view.status !== "running"} onClick={togglePause}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? "Seguir" : "Pausa"}</button></div>
      <div className="metric mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center text-sm">{(["human", "laya", "jev"] as Pilot[]).map(key => <div key={key}><span className="block text-xs text-muted">{LABEL[key]}</span><span className="mt-1 block text-lg">{best[key]}</span></div>)}</div>
    </section>
    <section className="panel flex flex-col p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Telemetría en vivo</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{thinking ? "Consultando…" : last ? last.action.toUpperCase() : view.status === "dead" ? "Fin de partida" : "Esperando vuelo"}</h2></div><span className={`metric rounded-md border px-3 py-1.5 text-xs ${pilot === "jev" ? "border-accent/40 text-accent-hi" : pilot === "laya" ? "border-laya/40 text-laya" : "border-line text-muted"}`}>{LABEL[pilot].toUpperCase()}</span></div>
      <p className="mt-3 min-h-10 text-sm leading-relaxed text-muted">{notice || (pilot === "human" ? "Toca el juego o pulsa espacio para aletear." : health[pilot].ok ? "El piloto observa el hueco en palabras. La física continúa mientras espera." : health[pilot].detail)}</p>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-line py-5 sm:grid-cols-4"><Stat label="Modelo" value={last ? formatMs(last.latencyMs) : "—"} /><Stat label="RTT" value={last ? formatMs(last.rttMs) : "—"} /><Stat label="Media" value={view.n ? formatMs(view.avgMs) : "—"} /><Stat label="Decisiones" value={String(view.n)} /></dl>
      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4"><Stat label="Tokens" value={String(view.tokens)} /><Stat label="Coste" value={formatUsd(view.costUsd)} /><Stat label="Aleteos" value={String(view.flaps)} /><Stat label="Tiempo" value={formatMs(view.elapsed * 1000)} /></dl>
      {last && <div className="mt-7 border-t border-line pt-5"><p className="eyebrow">Última decisión</p><p className="mt-3 text-sm text-ink">{last.state}</p><p className="metric mt-1 text-xs text-muted">{last.reason} · {last.model} · {last.tokens} tok</p><div className="mt-4 space-y-2">{(["below", "above"] as const).map(key => <div key={key} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-xs"><span className="text-muted">{key === "below" ? "Debajo" : "Encima"}</span><span className="h-2 overflow-hidden rounded-full bg-white/5"><span className="block h-full origin-left rounded-full bg-accent-hi transition-transform" style={{ transform: `scaleX(${last.probabilities[key] || 0})` }} /></span><span className="metric text-right">{Math.round((last.probabilities[key] || 0) * 100)}%</span></div>)}</div></div>}
      <div className="mt-7 border-t border-line pt-5"><p className="eyebrow mb-3">Registro reciente</p>{view.log.length ? <ol className="space-y-2">{view.log.map((item, index) => <li key={`${index}-${item.rttMs}`} className="metric flex items-center justify-between gap-4 text-xs"><span className={item.action === "flap" ? "text-accent-hi" : "text-laya"}>{item.action.toUpperCase()}</span><span className="truncate text-muted">{item.reason}</span><span>{formatMs(item.latencyMs)}</span></li>)}</ol> : <p className="text-sm text-muted">Las decisiones aparecerán aquí durante el vuelo.</p>}</div>
    </section>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted">{label}</dt><dd className="metric mt-2 text-lg">{value}</dd></div>; }
