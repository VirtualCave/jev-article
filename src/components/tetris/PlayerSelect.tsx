import { Cpu, HardDrives, Keyboard } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { PlayerKind } from "../../lib/tetris/types";

const OPTIONS: { id: PlayerKind; label: string; icon: typeof Cpu }[] = [
  { id: "jev", label: "Jev", icon: Cpu },
  { id: "laya", label: "Laya", icon: HardDrives },
  { id: "human", label: "Tu", icon: Keyboard },
];

export function PlayerSelect({
  side,
  value,
  onChange,
  availability,
}: {
  side: "left" | "right";
  value: PlayerKind;
  onChange: (player: PlayerKind) => void;
  availability: { jev: boolean; laya: boolean };
}) {
  const reduce = useReducedMotion();
  return (
    <div
      role="radiogroup"
      aria-label={side === "left" ? "Jugador izquierdo" : "Jugador derecho"}
      className="grid grid-cols-3 gap-1 rounded-[4px] border border-line bg-bg p-1"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.id !== "human" && !availability[opt.id]}
            onClick={() => onChange(opt.id)}
            className={`relative isolate flex h-9 items-center justify-center gap-1.5 rounded-[4px] px-2 text-[13px] font-medium transition-transform duration-150 active:scale-[0.98] ${
              active ? "text-accent-fg" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId={reduce ? undefined : `player-pill-${side}`}
                className="absolute inset-0 -z-10 rounded-[4px] bg-accent"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon size={15} weight="regular" className="shrink-0" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
