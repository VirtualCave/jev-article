"use client";

import { useEffect, useRef, useState } from "react";
import { ChatLine } from "./ChatLine";
import type { ChatLine as Line, Pilot } from "./model";

function stickToBottom(node: HTMLElement) {
  node.scrollTop = node.scrollHeight;
}

export function ChatPanel({
  lines,
  pilot,
  currentId,
  live,
  animate,
  onAllow,
  onBlock,
}: {
  lines: Line[];
  pilot: Pilot | null;
  currentId: string | null;
  live: boolean;
  animate: boolean;
  onAllow: (at: number) => void;
  onBlock: (at: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [paused, setPaused] = useState(false);
  const human = live && pilot === "human";

  useEffect(() => {
    const node = scroller.current;
    if (!node || !pinned.current) return;
    const id = requestAnimationFrame(() => {
      const box = scroller.current;
      if (!box || !pinned.current) return;
      stickToBottom(box);
    });
    return () => cancelAnimationFrame(id);
  }, [lines, currentId]);

  return (
    <section className="flex h-[min(480px,calc(100dvh-16.5rem))] min-h-0 flex-col overflow-hidden overflow-anchor-none rounded-xl border border-line bg-[#0b0e16]">
      <header className="flex shrink-0 items-center justify-between border-b border-white/8 px-3 py-2">
        <p className="text-[13px] font-semibold">Chat del stream</p>
        <p className="flex items-center gap-2 text-[11px] text-faint">
          {live && <span className="inline-flex items-center gap-1 font-semibold tracking-wide text-bad"><span className="h-1.5 w-1.5 rounded-full bg-bad motion-safe:animate-pulse" />EN DIRECTO</span>}
          <span className="metric">{lines.length}</span>
        </p>
      </header>
      <div
        ref={scroller}
        aria-label="Mensajes del chat"
        className="min-h-0 flex-1 overflow-y-scroll overflow-anchor-none overscroll-contain py-1 font-[family-name:var(--font-geist-sans)]"
        onScroll={event => {
          const node = event.currentTarget;
          const stick = node.scrollHeight - node.scrollTop - node.clientHeight < 56;
          pinned.current = stick;
          if (stick && paused) setPaused(false);
          else if (!stick && !paused) setPaused(true);
        }}
      >
        {lines.length === 0 && <p className="px-3 py-8 text-sm text-faint">{live ? "El chat está arrancando…" : "Elige un piloto para llenar el chat."}</p>}
        {lines.map(line => <ChatLine key={line.uid} line={line} pilot={pilot ?? "jev"} current={human && line.uid === currentId} animate={animate && live} />)}
      </div>
      {paused && live && (
        <button
          type="button"
          className="shrink-0 border-t border-white/8 bg-[#141824] px-3 py-2 text-center text-xs text-ink hover:bg-white/6"
          onClick={() => {
            pinned.current = true;
            setPaused(false);
            const node = scroller.current;
            if (node) stickToBottom(node);
          }}
        >
          Chat pausado por scroll. Volver al vivo
        </button>
      )}
      {human && (
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/8 p-2">
          <button type="button" className="btn min-h-10 text-sm" onClick={event => onAllow(event.timeStamp)}>A · permitir</button>
          <button type="button" className="btn btn-primary min-h-10 text-sm" onClick={event => onBlock(event.timeStamp)}>B · bloquear</button>
        </div>
      )}
    </section>
  );
}
