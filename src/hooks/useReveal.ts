"use client";

import { useEffect, useState } from "react";

/** cursor=null shows every item. Replay sets cursor to 0 and ticks up with a timeout. */
export function useReveal(total: number, reduce: boolean | null, delay = 70) {
  const [cursor, setCursor] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const shown = cursor === null || reduce ? total : Math.min(cursor, total);
  const playing = cursor !== null && !paused && !reduce && cursor < total;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setCursor(value => (value ?? 0) + 1), delay);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, delay]);

  return {
    shown,
    playing,
    replay: () => { setCursor(0); setPaused(false); },
    pause: () => setPaused(true),
    skip: () => { setCursor(null); setPaused(false); },
  };
}
