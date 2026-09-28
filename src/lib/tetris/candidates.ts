import { cellsOf } from "./pieces";
import { COLS, ROWS, type Board, type PieceType, type Placement } from "./types";

function columnHeights(board: Board): number[] {
  const heights = Array<number>(COLS).fill(0);
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (board[y][x] !== 0) {
        heights[x] = ROWS - y;
        break;
      }
    }
  }
  return heights;
}

function countHoles(board: Board): number {
  let holes = 0;
  for (let x = 0; x < COLS; x++) {
    let seen = false;
    for (let y = 0; y < ROWS; y++) {
      if (board[y][x] !== 0) seen = true;
      else if (seen) holes += 1;
    }
  }
  return holes;
}

function bumpinessOf(heights: number[]): number {
  let sum = 0;
  for (let x = 0; x < COLS - 1; x++) sum += Math.abs(heights[x] - heights[x + 1]);
  return sum;
}

function canPlace(board: Board, type: PieceType, rot: number, x: number, y: number) {
  for (const [r, c] of cellsOf(type, rot)) {
    const py = y + r;
    const px = x + c;
    if (px < 0 || px >= COLS || py >= ROWS) return false;
    if (py >= 0 && board[py][px] !== 0) return false;
  }
  return true;
}

function drop(board: Board, type: PieceType, rot: number, x: number): number | null {
  if (!canPlace(board, type, rot, x, 0)) return null;
  let y = 0;
  while (canPlace(board, type, rot, x, y + 1)) y += 1;
  return y;
}

function apply(board: Board, type: PieceType, rot: number, x: number, y: number): Board {
  const next = board.map((row) => row.slice()) as Board;
  for (const [r, c] of cellsOf(type, rot)) {
    const py = y + r;
    const px = x + c;
    if (py >= 0 && py < ROWS) next[py][px] = 1;
  }
  const kept = next.filter((row) => row.some((cell) => cell === 0));
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(0));
  return kept as Board;
}

function linesCleared(board: Board, type: PieceType, rot: number, x: number, y: number) {
  const filled = new Set<number>();
  for (const [r] of cellsOf(type, rot)) filled.add(y + r);
  let n = 0;
  for (const row of filled) {
    if (row < 0 || row >= ROWS) continue;
    let full = true;
    for (let c = 0; c < COLS; c++) {
      const occupied = board[row][c] !== 0 || cellsOf(type, rot).some(([rr, cc]) => y + rr === row && x + cc === c);
      if (!occupied) {
        full = false;
        break;
      }
    }
    if (full) n += 1;
  }
  return n;
}

export function listPlacements(board: Board, type: PieceType): Placement[] {
  const beforeHoles = countHoles(board);
  const uniq = new Map<string, Placement>();

  for (let rot = 0; rot < 4; rot++) {
    for (let x = -2; x < COLS; x++) {
      const y = drop(board, type, rot, x);
      if (y === null) continue;
      const next = apply(board, type, rot, x, y);
      const heights = columnHeights(next);
      const holes = countHoles(next);
      const aggregateHeight = heights.reduce((a, b) => a + b, 0);
      const bumpiness = bumpinessOf(heights);
      const maxHeight = Math.max(...heights);
      const lines = linesCleared(board, type, rot, x, y);
      const holesCreated = Math.max(0, holes - beforeHoles);
      const heuristic =
        lines * 12 -
        holes * 7 -
        holesCreated * 9 -
        bumpiness * 1.4 -
        aggregateHeight * 0.45 -
        Math.max(0, maxHeight - 12) * 3;

      const placement: Placement = {
        id: `r${rot}c${x < 0 ? "m" + Math.abs(x) : x}`,
        rotation: rot,
        x,
        y,
        lines,
        holes,
        holesCreated,
        aggregateHeight,
        bumpiness,
        maxHeight,
        heuristic,
        description: "",
      };
      const signature = next.map((row) => row.join("")).join("/");
      const prev = uniq.get(signature);
      if (!prev || placement.heuristic > prev.heuristic) uniq.set(signature, placement);
    }
  }

  return [...uniq.values()].sort((a, b) => b.heuristic - a.heuristic);
}

export function shortlist(placements: Placement[], limit = 5): Placement[] {
  const picked: Placement[] = [];
  const take = (p: Placement | undefined) => {
    if (!p) return;
    if (picked.some((x) => x.rotation === p.rotation && x.x === p.x)) return;
    picked.push(p);
  };

  take(placements[0]);
  take(placements.find((p) => p.lines > 0));
  take(placements.find((p) => p.holesCreated === 0 && p.lines === 0));

  for (const p of placements) {
    if (picked.length >= limit) break;
    take(p);
  }
  return picked.slice(0, limit);
}
