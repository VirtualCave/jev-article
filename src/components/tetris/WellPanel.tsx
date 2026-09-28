import { BoardGrid, NextPiece } from "./BoardGrid";
import { DecisionStrip, MoveMeter } from "./DecisionStrip";
import { PlayerSelect } from "./PlayerSelect";
import { useWell } from "../../hooks/useWell";
import { useEffect } from "react";
import type { MatchStatus, PlayerKind, Side } from "../../lib/tetris/types";

const TITLES: Record<Side, string> = {
  left: "Pozo izquierdo",
  right: "Pozo derecho",
};

export type WellProgress = { score: number; lines: number; status: string; pieceIndex: number; costUsd: number; decisions: number; decideMs: number; latencyMs: number };

export function WellPanel({
  side,
  player,
  onPlayer,
  seed,
  match,
  bothHuman,
  healthDetail,
  availability,
  onProgress,
}: {
  side: Side;
  player: PlayerKind;
  onPlayer: (player: PlayerKind) => void;
  seed: number;
  match: MatchStatus;
  bothHuman: boolean;
  healthDetail: string;
  availability: { jev: boolean; laya: boolean };
  onProgress: (side: Side, progress: WellProgress) => void;
}) {
  const { view, trace, notice, spend, timing } = useWell({ seed, player, match, side, bothHuman });
  useEffect(() => onProgress(side, { score: view.score, lines: view.lines, status: view.status, pieceIndex: view.pieceIndex, costUsd: spend.costUsd, ...timing }), [onProgress, side, view.score, view.lines, view.status, view.pieceIndex, spend.costUsd, timing]);
  const human = player === "human";
  const keys =
    bothHuman && side === "left"
      ? "A D mover. W girar. S bajar. Q dejar caer."
      : bothHuman && side === "right"
        ? "Flechas mover. Arriba girar. Abajo bajar. Enter dejar caer."
        : "Flechas o A D. Girar W o Arriba. Bajar S. Dejar caer espacio.";

  return (
    <article className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-tight text-ink">{TITLES[side]}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {player === "human"
              ? "Control al teclado"
              : player === "jev"
                ? "Jev, System One de TypeSafe"
                : "Laya en local"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl leading-none tabular-nums text-ink">{view.score}</p>
          <p className="mt-1 font-mono text-[11px] text-muted">{view.lines} lineas</p>
        </div>
      </header>

      <PlayerSelect side={side} value={player} onChange={onPlayer} availability={availability} />

      {player !== "human" && (
        <p className="text-xs text-muted">{healthDetail}</p>
      )}

      <MoveMeter trace={trace} status={view.status} player={player} spend={spend} />
      {player !== "human" && <p className="text-xs text-muted">El pozo espera al modelo; se mide el tiempo de decisión.</p>}

      <div className={`flex items-start gap-4 ${side === "right" ? "md:flex-row-reverse" : ""}`}>
        <div className="relative w-[min(100%,280px)]">
          <BoardGrid
            snapshot={view}
            showGhost={human}
            label={`${TITLES[side]}, ${view.score} puntos`}
          />
          {view.status === "over" && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/72">
              <p className="text-sm font-medium text-ink">Pozo lleno</p>
            </div>
          )}
          {view.status === "thinking" && (
            <div className="absolute inset-0 flex items-end justify-center bg-bg/20 pb-4">
              <p className="rounded-[4px] bg-bg-elev px-2 py-1 text-xs text-ink">Eligiendo</p>
            </div>
          )}
        </div>
        <div className="flex w-16 shrink-0 flex-col gap-3 pt-1">
          <div>
            <p className="mb-1 font-mono text-[10px] text-muted">Sigue</p>
            <NextPiece type={view.next} />
          </div>
        </div>
      </div>

      {human && match === "running" && view.status !== "over" && (
        <p className="text-xs text-muted">{keys}</p>
      )}

      <DecisionStrip trace={trace} status={view.status} notice={notice} />
    </article>
  );
}
