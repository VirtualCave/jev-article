import { cellsOf, PIECE_IDS } from "./pieces";
import { fillBag, mulberry32 } from "./rng";
import {
  COLS,
  ROWS,
  type ActivePiece,
  type Board,
  type Cell,
  type PieceType,
  type WellSnapshot,
  type WellStatus,
} from "./types";

const LINE_SCORES = [0, 100, 300, 500, 800];
const GRAVITY_MS = 720;
const LOCK_MS = 480;

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));
}

function collides(board: Board, piece: ActivePiece): boolean {
  for (const [r, c] of cellsOf(piece.type, piece.rot)) {
    const y = piece.y + r;
    const x = piece.x + c;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y][x] !== 0) return true;
  }
  return false;
}

function paint(board: Board, piece: ActivePiece, id: Cell): Board {
  const next = board.map((row) => row.slice()) as Board;
  for (const [r, c] of cellsOf(piece.type, piece.rot)) {
    const y = piece.y + r;
    const x = piece.x + c;
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = id;
  }
  return next;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(Array<Cell>(COLS).fill(0));
  return { board: kept as Board, cleared };
}

function dropY(board: Board, piece: ActivePiece): number {
  let y = piece.y;
  const probe = { ...piece };
  while (true) {
    probe.y = y + 1;
    if (collides(board, probe)) return y;
    y += 1;
  }
}

export class WellEngine {
  board: Board = emptyBoard();
  active: ActivePiece | null = null;
  next: PieceType;
  bag: PieceType[] = [];
  score = 0;
  lines = 0;
  status: WellStatus = "ready";
  pieceIndex = 0;
  private rand: () => number;
  private lockTimer = 0;
  private gravityTimer = 0;

  constructor(readonly seed: number) {
    this.rand = mulberry32(seed);
    this.bag = fillBag(this.rand);
    this.next = this.takeBag();
  }

  snapshot(): WellSnapshot {
    return {
      board: this.board.map((row) => row.slice()) as Board,
      active: this.active ? { ...this.active } : null,
      ghostY: this.active ? dropY(this.board, this.active) : null,
      next: this.next,
      score: this.score,
      lines: this.lines,
      status: this.status,
      pieceIndex: this.pieceIndex,
    };
  }

  start() {
    if (this.status === "over") return;
    if (!this.active) this.spawn();
    if (this.active) this.status = "playing";
    this.gravityTimer = 0;
    this.lockTimer = 0;
  }

  pause() {
    if (this.status === "playing" || this.status === "thinking" || this.status === "animating") {
      this.status = "ready";
    }
  }

  setStatus(status: WellStatus) {
    this.status = status;
  }

  move(dx: number): boolean {
    if (!this.active || this.status === "over") return false;
    const next = { ...this.active, x: this.active.x + dx };
    if (collides(this.board, next)) return false;
    this.active = next;
    this.lockTimer = 0;
    return true;
  }

  rotate(): boolean {
    if (!this.active || this.status === "over") return false;
    const rot = (this.active.rot + 1) & 3;
    for (const kick of [0, -1, 1, -2, 2]) {
      const next = { ...this.active, rot, x: this.active.x + kick };
      if (!collides(this.board, next)) {
        this.active = next;
        this.lockTimer = 0;
        return true;
      }
    }
    return false;
  }

  softDrop(): boolean {
    if (!this.active || this.status === "over") return false;
    const next = { ...this.active, y: this.active.y + 1 };
    if (collides(this.board, next)) return false;
    this.active = next;
    this.score += 1;
    this.gravityTimer = 0;
    return true;
  }

  hardDrop(): boolean {
    if (!this.active || this.status === "over") return false;
    const y = dropY(this.board, this.active);
    this.score += 2 * Math.max(0, y - this.active.y);
    this.active = { ...this.active, y };
    this.lock();
    return true;
  }

  forcePose(rot: number, x: number): boolean {
    if (!this.active || this.status === "over") return false;
    for (let y = this.active.y; y >= 0; y--) {
      const next = { ...this.active, rot: rot & 3, x, y };
      if (!collides(this.board, next)) { this.active = next; return true; }
    }
    return false;
  }

  tick(dt: number) {
    if (this.status !== "playing" || !this.active) return;
    const grounded = this.isGrounded();
    if (grounded) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_MS) this.lock();
      return;
    }
    this.lockTimer = 0;
    this.gravityTimer += dt;
    if (this.gravityTimer >= GRAVITY_MS) {
      this.gravityTimer = 0;
      const next = { ...this.active, y: this.active.y + 1 };
      if (!collides(this.board, next)) this.active = next;
    }
  }

  isGrounded() {
    if (!this.active) return false;
    return collides(this.board, { ...this.active, y: this.active.y + 1 });
  }

  private lock() {
    if (!this.active) return;
    this.board = paint(this.board, this.active, PIECE_IDS[this.active.type]);
    const cleared = clearLines(this.board);
    this.board = cleared.board;
    this.score += LINE_SCORES[cleared.cleared] ?? 0;
    this.lines += cleared.cleared;
    this.active = null;
    this.lockTimer = 0;
    this.gravityTimer = 0;
    this.spawn();
  }

  private spawn() {
    const type = this.next;
    this.next = this.takeBag();
    this.pieceIndex += 1;
    const active: ActivePiece = { type, rot: 0, x: 3, y: 0 };
    if (collides(this.board, active)) {
      this.active = null;
      this.status = "over";
      return;
    }
    this.active = active;
  }

  private takeBag(): PieceType {
    if (this.bag.length === 0) this.bag = fillBag(this.rand);
    return this.bag.pop()!;
  }
}

export { collides, dropY, paint, clearLines, emptyBoard };
