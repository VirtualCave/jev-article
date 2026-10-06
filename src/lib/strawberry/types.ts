export type Mode = "single" | "batch" | "fanout";
export type Call = { id: string; label: string; startMs: number; endMs: number; latencyMs: number; inputTokens: number };
export type PerLetter = { index: number; char: string; noul: number; isTarget: boolean };
export type BenchResult = { ok: true; mode: Mode; word: string; letter: string; model: string; wallMs: number; calls: Call[]; count: number; truth: number; correct: boolean; perLetter?: PerLetter[]; softCount?: number; probabilities?: Record<string, number>; usage: { inputTokens: number; costUsd: number } };
export type BenchError = { ok: false; code: "auth" | "bad_request" | "offline" | "upstream"; error: string };
