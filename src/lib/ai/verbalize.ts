import { COLS, ROWS, type Board, type PieceType, type Placement } from "../tetris/types";

const PIECE_WORDS: Record<PieceType, string> = {
  I: "a long straight bar",
  O: "a square block",
  T: "a T-shaped piece",
  S: "an S-shaped piece",
  Z: "a Z-shaped piece",
  J: "a J-shaped piece",
  L: "an L-shaped piece",
};

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

function holes(board: Board): number {
  let n = 0;
  for (let x = 0; x < COLS; x++) {
    let seen = false;
    for (let y = 0; y < ROWS; y++) {
      if (board[y][x] !== 0) seen = true;
      else if (seen) n += 1;
    }
  }
  return n;
}

function heightPhrase(maxH: number) {
  if (maxH <= 4) return "The stack is very low.";
  if (maxH <= 10) return "The stack is mid-height.";
  if (maxH <= 15) return "The stack is high.";
  return "The stack is near the top.";
}

function floorPhrase(bump: number) {
  if (bump <= 2) return "The floor is even.";
  if (bump <= 6) return "The floor is gently uneven.";
  return "The floor is spiky with deep gaps.";
}

function holePhrase(n: number) {
  if (n === 0) return "No buried empty cells.";
  if (n <= 2) return "A few buried empty cells.";
  return "Many buried empty cells.";
}

function gapPhrase(heights: number[]) {
  let best = -1;
  let depth = 0;
  for (let x = 0; x < COLS; x++) {
    const left = x === 0 ? heights[x] : heights[x - 1];
    const right = x === COLS - 1 ? heights[x] : heights[x + 1];
    const d = Math.min(left, right) - heights[x];
    if (d >= 3 && d > depth) {
      depth = d;
      best = x;
    }
  }
  if (best < 0) return "";
  if (best <= 1) return "A deep gap sits on the far left.";
  if (best <= 3) return "A deep gap sits on the left.";
  if (best <= 6) return "A deep gap sits near the center.";
  if (best <= 8) return "A deep gap sits on the right.";
  return "A deep gap sits on the far right.";
}

export function pieceWords(type: PieceType) {
  return PIECE_WORDS[type];
}

export function describeWell(board: Board): string {
  const heights = columnHeights(board);
  const maxH = Math.max(0, ...heights);
  const bump = heights.slice(1).reduce((s, h, i) => s + Math.abs(h - heights[i]), 0);
  return [heightPhrase(maxH), floorPhrase(bump), gapPhrase(heights), holePhrase(holes(board))]
    .filter(Boolean)
    .join(" ");
}

export function describePlacement(p: Placement): string {
  const bits: string[] = [];
  if (p.lines === 1) bits.push("Clears one row.");
  else if (p.lines === 2) bits.push("Clears two rows.");
  else if (p.lines >= 3) bits.push("Clears several rows.");
  else bits.push("No full row.");

  if (p.holesCreated > 0) bits.push("Buries empty cells.");
  else bits.push("No buried cells.");

  if (p.bumpiness <= 2) bits.push("Floor even.");
  else if (p.bumpiness <= 6) bits.push("Floor a bit uneven.");
  else bits.push("Floor spiky.");

  if (p.maxHeight >= 14) bits.push("Stack near the top.");
  else if (p.maxHeight <= 4) bits.push("Stack stays low.");

  return bits.join(" ");
}

const CRITERIA_MAX = 180;

export function clip(text: string, max = CRITERIA_MAX) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd();
}
