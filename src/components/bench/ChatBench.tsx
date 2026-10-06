"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useHealth } from "@/hooks/useHealth";
import { ChatPanel } from "./chat/ChatPanel";
import { emptyLive, pilotLabel, PILOTS, type ChatLine, type LiveStats, type Pilot, type Report } from "./chat/model";
import { MODEL_PILOTS, PILOT_LABEL } from "@/lib/ai/pilots";
import { ChatStream } from "./chat/runStream";
import { RunSummary } from "./chat/RunSummary";
import { StreamStats } from "./chat/StreamStats";

const CHAT_REPORTS_KEY = "jev-chat-reports-v3";

function readReports(): Partial<Record<Pilot, Report>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHAT_REPORTS_KEY);
    return raw ? JSON.parse(raw) as Partial<Record<Pilot, Report>> : {};
  } catch {
    return {};
  }
}

function writeReports(reports: Partial<Record<Pilot, Report>>) {
  try { window.localStorage.setItem(CHAT_REPORTS_KEY, JSON.stringify(reports)); } catch { /* quota */ }
}

export function ChatBench() {
  const health = useHealth();
  const reduce = useReducedMotion();
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [last, setLast] = useState<Pilot | null>(null);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [live, setLive] = useState<LiveStats>(emptyLive());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [reports, setReports] = useState<Partial<Record<Pilot, Report>>>(readReports);
  const streamRef = useRef<ChatStream | null>(null);

  useEffect(() => {
    writeReports(reports);
  }, [reports]);

  useEffect(() => {
    const html = document.documentElement;
    const prevAnchor = html.style.overflowAnchor;
    const prevBehavior = html.style.scrollBehavior;
    html.style.overflowAnchor = "none";
    html.style.scrollBehavior = "auto";
    return () => {
      html.style.overflowAnchor = prevAnchor;
      html.style.scrollBehavior = prevBehavior;
      streamRef.current?.abort();
    };
  }, []);

  const start = (selected: Pilot) => {
    streamRef.current?.abort();
    setPilot(selected);
    setLast(selected);
    setError("");
    setLines([]);
    setLive(emptyLive());
    setCurrentId(null);
    const stream = new ChatStream(selected, {
      onUpdate: state => {
        setLive(state.live);
        setLines(state.lines);
        setCurrentId(state.currentId);
      },
      onReport: report => setReports(previous => ({ ...previous, [selected]: report })),
      onError: message => setError(previous => previous || message),
    });
    streamRef.current = stream;
    void stream.start().finally(() => {
      if (streamRef.current !== stream) return;
      streamRef.current = null;
      setPilot(null);
    });
  };

  const moderate = (flag: boolean, at: number) => {
    streamRef.current?.moderate(flag, at);
  };

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== "a" && key !== "b") return;
      if (!streamRef.current) return;
      event.preventDefault();
      streamRef.current.moderate(key === "b", event.timeStamp);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  const who = last ? pilotLabel(last) : "";
  return (
    <div className="overflow-anchor-none space-y-4">
      <section className="panel px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">150 mensajes / Poisson 1–40 msg/s</p>
            <p className="mt-1 text-sm text-muted">A permite · B bloquea. El ritmo sostenible es el más alto antes del primer fallo; el stream sigue hasta el final o hasta saturarse.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PILOTS.map(selected => (
              <button key={selected} type="button" className={`btn ${selected === "jev" ? "btn-primary" : ""}`} disabled={!!pilot || (selected !== "human" && !health[selected].ok)} onClick={() => start(selected)}>
                Probar {selected === "human" ? "persona" : PILOT_LABEL[selected]}
              </button>
            ))}
            {pilot && <button type="button" className="btn" onClick={() => streamRef.current?.abort()}>Detener</button>}
          </div>
        </div>
        {MODEL_PILOTS.filter(id => !health[id].ok).map(id => <p key={id} className="mt-1 text-xs text-warn">{PILOT_LABEL[id]}: {health[id].detail}</p>)}
        {error && <p className="mt-2 text-sm text-bad">{error} Ese mensaje cuenta como perdido.</p>}
      </section>
      <div className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] min-[700px]:items-stretch">
        <ChatPanel
          lines={lines}
          pilot={pilot ?? last}
          currentId={currentId}
          live={!!pilot}
          animate={!reduce && live.rate < 12}
          onAllow={at => moderate(false, at)}
          onBlock={at => moderate(true, at)}
        />
        <StreamStats live={live} running={!!pilot} who={who} />
      </div>
      <RunSummary reports={reports} last={last} running={!!pilot} />
    </div>
  );
}
