"use client";

import { Check, X } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { memo, type ReactNode } from "react";
import { chatGarnish } from "@/lib/data/chat";
import { removedLabel, type ChatLine as Line, type Pilot } from "./model";

const TOKEN = /(\b(?:Pog|Kappa|LUL|KEKW|GG|WP|EZ)\b|<3|:D|:P|:\)|:\()/g;
const BADGE: Record<string, { label: string; className: string }> = {
  mod: { label: "MOD", className: "bg-[#00ad03] text-white" },
  vip: { label: "VIP", className: "bg-[#e005b9] text-white" },
  sub: { label: "SUB", className: "bg-[#6441a5] text-white" },
  prime: { label: "PRIME", className: "bg-[#0099fa] text-white" },
};

function Emote({ token }: { token: string }) {
  return <span className="mx-0.5 inline-flex translate-y-px items-center rounded-sm bg-white/10 px-1 py-px font-mono text-[10px] font-semibold tracking-wide text-ink">{token}</span>;
}

function Body({ text, extra }: { text: string; extra: string[] }) {
  const source = extra.length ? `${text} ${extra.join(" ")}` : text;
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const hit of source.matchAll(TOKEN)) {
    const offset = hit.index ?? 0;
    if (offset > last) parts.push(source.slice(last, offset));
    parts.push(<Emote key={`e${key++}`} token={hit[0]} />);
    last = offset + hit[0].length;
  }
  if (last < source.length) parts.push(source.slice(last));
  return <>{parts}</>;
}

function ChatLineView({ line, pilot, current, animate }: { line: Line; pilot: Pilot; current: boolean; animate: boolean }) {
  if (line.status === "break" && line.marker) {
    return (
      <div className="my-1.5 flex items-center gap-2 px-3 py-1 text-[11px] font-semibold tracking-wide text-bad">
        <span className="h-px flex-1 bg-bad/40" />
        aquí se rompió: {line.marker.rate} msg/s
        <span className="h-px flex-1 bg-bad/40" />
      </div>
    );
  }
  const { item, status, late, verdict } = line;
  const removed = status === "removed";
  const missed = status === "missed";
  const pending = status === "pending";
  const extra = pending || status === "approved" ? chatGarnish(item.id, item.toxic, item.spam) : [];
  const mark = verdict ? (verdict.correct ? "ok" : "bad") : missed ? "miss" : null;
  const className = [
    "grid grid-cols-[1fr_auto] items-start gap-2 px-3 py-0.5 text-[13px] leading-5",
    current ? "bg-white/8" : missed ? "bg-[rgb(255_92_122_/_0.12)]" : late ? "bg-[rgb(242_181_68_/_0.08)]" : "hover:bg-white/4",
  ].join(" ");

  const inner = (
    <>
      <p className="min-w-0">
        {item.user.badges.map(badge => {
          const meta = BADGE[badge];
          return <span key={badge} className={`mr-1 inline-flex h-4 translate-y-px items-center rounded-sm px-1 text-[9px] font-bold leading-none ${meta.className}`}>{meta.label}</span>;
        })}
        <span className="mr-1.5 font-semibold" style={{ color: item.user.color }}>{item.user.name}</span>
        {removed ? <span className="italic text-faint">{removedLabel(pilot)}</span> : missed ? <span className="text-bad">{item.text}</span> : <span className={late ? "text-warn" : "text-ink"}><Body text={item.text} extra={extra} /></span>}
        {pending && <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warn align-middle ${late ? "" : "motion-safe:animate-pulse"}`} title={late ? "Sin revisar a tiempo" : "En revisión"} />}
      </p>
      <span className="mt-0.5 flex h-4 w-4 items-center justify-center" title={verdict ? (verdict.correct ? "Acierto" : "Error") : missed ? "No revisado" : undefined} aria-hidden="true">
        {mark === "ok" && <Check size={11} weight="bold" className="text-ok/70" />}
        {mark === "bad" && <X size={11} weight="bold" className="text-bad" />}
        {mark === "miss" && <span className="block h-1.5 w-1.5 rounded-full bg-bad" />}
      </span>
    </>
  );

  if (!animate) return <div className={className} data-current={current || undefined}>{inner}</div>;
  return <motion.div className={className} data-current={current || undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12, ease: "easeOut" }}>{inner}</motion.div>;
}

export const ChatLine = memo(ChatLineView);
