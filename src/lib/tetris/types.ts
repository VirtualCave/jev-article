import type { ModelPilot } from "../ai/pilots";

export const COLS = 10;
export const ROWS = 20;

export const PIECE_TYPES = ["I", "O", "T", "S", "Z", "J", "L"] as const;
export type PieceType = (typeof PIECE_TYPES)[number];

export type PlayerKind = ModelPilot | "human";
export type Side = "left" | "right";
export type MatchStatus = "idle" | "running" | "paused";
export type WellStatus = "ready" | "playing" | "thinking" | "animating" | "over";

export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Board = Cell[][];

export type ActivePiece = {
  type: PieceType;
  rot: number;
  x: number;
  y: number;
};

export type WellSnapshot = {
  board: Board;
  active: ActivePiece | null;
  ghostY: number | null;
  next: PieceType;
  score: number;
  lines: number;
  status: WellStatus;
  pieceIndex: number;
};

export type Placement = {
  id: string;
  rotation: number;
  x: number;
  y: number;
  lines: number;
  holes: number;
  holesCreated: number;
  aggregateHeight: number;
  bumpiness: number;
  maxHeight: number;
  heuristic: number;
  description: string;
};
