import { cellsOf, PIECE_FROM_ID, PIECE_IDS } from "../../lib/tetris/pieces";
import type { PieceType, WellSnapshot } from "../../lib/tetris/types";
import { COLS, ROWS } from "../../lib/tetris/types";

type Painted = { id: number; ghost: boolean };

function paintCells(snapshot: WellSnapshot, showGhost: boolean): Painted[][] {
  const grid: Painted[][] = snapshot.board.map((row) =>
    row.map((id) => ({ id, ghost: false })),
  );
  if (snapshot.active && showGhost && snapshot.ghostY != null) {
    const pid = PIECE_IDS[snapshot.active.type];
    for (const [r, c] of cellsOf(snapshot.active.type, snapshot.active.rot)) {
      const y = snapshot.ghostY + r;
      const x = snapshot.active.x + c;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS && grid[y][x].id === 0) {
        grid[y][x] = { id: pid, ghost: true };
      }
    }
  }
  if (snapshot.active) {
    const id = PIECE_IDS[snapshot.active.type];
    for (const [r, c] of cellsOf(snapshot.active.type, snapshot.active.rot)) {
      const y = snapshot.active.y + r;
      const x = snapshot.active.x + c;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) grid[y][x] = { id, ghost: false };
    }
  }
  return grid;
}

export function BoardGrid({
  snapshot,
  showGhost,
  label,
}: {
  snapshot: WellSnapshot;
  showGhost: boolean;
  label: string;
}) {
  const grid = paintCells(snapshot, showGhost);
  return (
    <div
      role="img"
      aria-label={label}
      className="well-grid aspect-[1/2] w-[min(100%,280px)]"
    >
      {grid.flatMap((row, y) =>
        row.map((cell, x) => (
          <span
            key={`${y}-${x}`}
            data-id={cell.id}
            data-ghost={cell.ghost ? "1" : undefined}
            data-piece={cell.id > 0 ? PIECE_FROM_ID[cell.id] : undefined}
            className="mino"
          />
        )),
      )}
    </div>
  );
}

export function NextPiece({ type }: { type: PieceType }) {
  const cells = cellsOf(type, 0);
  const id = PIECE_IDS[type];
  return (
    <div className="grid h-14 w-14 grid-cols-4 grid-rows-4 gap-px" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const on = cells.some(([y, x]) => y === r && x === c);
        return <span key={i} data-id={on ? id : 0} className="mino" />;
      })}
    </div>
  );
}
