import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { composeMove, type MoveTrace, type SpendMeter } from "../lib/ai/compose";
import { requestDecision } from "../lib/ai/client";
import { buildDecisionInput, tagPlacements } from "../lib/ai/questions";
import { listPlacements, shortlist } from "../lib/tetris/candidates";
import { WellEngine } from "../lib/tetris/engine";
import type { MatchStatus, PlayerKind, Side, WellSnapshot } from "../lib/tetris/types";

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

export function useWell(opts: {
  seed: number;
  player: PlayerKind;
  match: MatchStatus;
  side: Side;
  bothHuman: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [initialEngine] = useState(() => new WellEngine(opts.seed));
  const engineRef = useRef<WellEngine>(initialEngine);
  const playerRef = useRef(opts.player);
  const matchRef = useRef(opts.match);
  const bothHumanRef = useRef(opts.bothHuman);
  useEffect(() => { playerRef.current = opts.player; matchRef.current = opts.match; bothHumanRef.current = opts.bothHuman; }, [opts.player, opts.match, opts.bothHuman]);

  const [view, setView] = useState<WellSnapshot>(() => initialEngine.snapshot());
  const [trace, setTrace] = useState<MoveTrace | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [spend, setSpend] = useState<SpendMeter>({ costUsd: 0, inputTokens: 0, calls: 0 });
  const [timing, setTiming] = useState({ decisions: 0, decideMs: 0, latencyMs: 0 });
  const lastDecided = useRef(-1);
  const inflight = useRef(false);
  const skipUntil = useRef(0);
  const reduceRef = useRef(reduceMotion);
  useEffect(() => { reduceRef.current = reduceMotion; }, [reduceMotion]);
  const publish = useCallback(() => setView(engineRef.current.snapshot()), []);

  useEffect(() => {
    const engine = engineRef.current;
    if (opts.match === "running") {
      if (engine.status === "over") return;
      if (engine.status === "ready" || engine.status === "playing") engine.start();
      publish();
      return;
    }
    if (opts.match === "paused") {
      engine.pause();
      publish();
    }
  }, [opts.match, opts.seed, publish]);

  useEffect(() => {
    if (opts.match !== "running") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const engine = engineRef.current;
      if (engine.status === "playing") {
        engine.tick(dt);
        setView(engine.snapshot());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [opts.match, opts.seed]);

  useEffect(() => { lastDecided.current = -1; skipUntil.current = 0; }, [opts.player]);

  useEffect(() => {
    if (opts.match !== "running") return;
    const player = opts.player;
    if (player === "human") return;
    const engine = engineRef.current;
    if (!engine.active || engine.status === "over") return;
    if (engine.status === "thinking" || engine.status === "animating") return;
    if (lastDecided.current === engine.pieceIndex) return;
    if (inflight.current) return;

    const pieceIndex = engine.pieceIndex;
    const type = engine.active.type;
    const next = engine.next;
    const board = engine.snapshot().board;
    const placements = shortlist(listPlacements(board, type), 5);
    if (placements.length === 0) return;

    lastDecided.current = pieceIndex;
    inflight.current = true;
    const tagged = tagPlacements(placements);
    const controller = new AbortController();

    const run = async () => {
      engine.setStatus("thinking");
      publish();
      const thinkStarted = performance.now();
      try {
        let move: MoveTrace;
        if (tagged.length === 1) {
          move = {
            source: "shortlist",
            placement: tagged[0],
            note: "Solo habia una caida legal.",
          };
        } else if (Date.now() < skipUntil.current) {
          move = composeMove(tagged, null);
          move.note = "El modelo no esta disponible. Se usa la lista corta.";
        } else {
          const payload = buildDecisionInput(board, type, next, tagged);
          const result = await requestDecision(
            player,
            payload.state,
            payload.questions,
            controller.signal,
          );
          move = composeMove(tagged, result);
          if (!result.ok) {
            setNotice(result.error);
            if (result.code === "auth" || result.code === "offline") {
              skipUntil.current = Date.now() + 8000;
            }
          } else {
            setNotice(null);
            skipUntil.current = 0;
          }
        }
        if (controller.signal.aborted) return;
        move.decideMs = Math.round(performance.now() - thinkStarted);
        setTiming((prev) => ({ decisions: prev.decisions + 1, decideMs: prev.decideMs + (move.decideMs ?? 0), latencyMs: prev.latencyMs + (move.latencyMs ?? 0) }));
        if (move.usage) {
          const billed = move.usage;
          setSpend((prev) => ({
            costUsd: prev.costUsd + (billed.costUsd ?? 0),
            inputTokens: prev.inputTokens + (billed.input_tokens ?? 0),
            calls: prev.calls + 1,
          }));
        }
        setTrace(move);

        const dwell = reduceRef.current ? 0 : 320;
        const leftover = dwell - (performance.now() - thinkStarted);
        if (leftover > 0) await wait(leftover, controller.signal);

        engine.setStatus("animating");
        publish();
        const delay = reduceRef.current ? 0 : 55;
        if (!reduceRef.current) {
          let guard = 0;
          while (engine.active && engine.active.rot !== move.placement.rotation && guard < 6) {
            engine.rotate();
            publish();
            await wait(delay, controller.signal);
            guard += 1;
          }
          guard = 0;
          while (engine.active && engine.active.x !== move.placement.x && guard < 14) {
            const dir = engine.active.x < move.placement.x ? 1 : -1;
            if (!engine.move(dir)) break;
            publish();
            await wait(delay, controller.signal);
            guard += 1;
          }
        }
        if (engine.active && (engine.active.rot !== move.placement.rotation || engine.active.x !== move.placement.x)) {
          if (!engine.forcePose(move.placement.rotation, move.placement.x)) {
            const reachable = tagged.find((candidate) => engine.forcePose(candidate.rotation, candidate.x));
            move = { ...move, source: "shortlist", placement: reachable ?? tagged[0], note: reachable ? "La jugada elegida no era alcanzable. Se usa la mejor caída alcanzable." : "La jugada elegida no era alcanzable. Se deja caer la pieza actual." };
            setTrace(move);
          }
          publish();
        }
        if (!reduceRef.current) await wait(90, controller.signal);
        engine.hardDrop();
        if (engine.status !== "over") engine.setStatus("playing");
        inflight.current = false;
        publish();
      } catch (err) {
        inflight.current = false;
        if (isAbort(err)) return;
        lastDecided.current = -1;
        setNotice(err instanceof Error ? err.message : "Fallo al elegir jugada.");
        if (engine.status !== "over") engine.setStatus("playing");
        publish();
      }
    };

    void run();
    return () => {
      controller.abort();
      inflight.current = false;
      if (engine.pieceIndex === pieceIndex) lastDecided.current = -1;
      if (engine.pieceIndex === pieceIndex && (engine.status === "thinking" || engine.status === "animating")) {
        engine.setStatus(matchRef.current === "paused" ? "ready" : "playing");
      }
    };
  }, [opts.match, opts.player, opts.seed, view.pieceIndex, publish]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (matchRef.current !== "running") return;
      if (playerRef.current !== "human") return;
      const engine = engineRef.current;
      if (engine.status !== "playing" || !engine.active) return;

      const left = ["KeyA", "KeyD", "KeyW", "KeyS", "KeyQ"];
      const right = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"];
      const codes = bothHumanRef.current
        ? opts.side === "left"
          ? left
          : right
        : [...left, ...right, "Space"];
      if (!codes.includes(event.code)) return;
      event.preventDefault();

      if (event.code === "KeyA" || event.code === "ArrowLeft") engine.move(-1);
      else if (event.code === "KeyD" || event.code === "ArrowRight") engine.move(1);
      else if (event.code === "KeyW" || event.code === "ArrowUp") engine.rotate();
      else if (event.code === "KeyS" || event.code === "ArrowDown") engine.softDrop();
      else if (event.code === "KeyQ" || event.code === "Enter" || event.code === "Space") engine.hardDrop();
      publish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts.side, publish]);

  return { view, trace, notice, spend, timing };
}
