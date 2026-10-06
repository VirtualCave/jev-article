import "server-only";
import type { Question } from "@typesafe-ai/sdk";
import { askModel } from "@/lib/ai/models";
import type { ModelPilot } from "@/lib/ai/pilots";
import { packAnswers, type PackedAnswer } from "@/lib/ai/http";
import type { Bench } from "./sets";

export type BenchAnswer = PackedAnswer;
export type BenchResult = { ok: true; model: string; answers: Record<string, BenchAnswer>; latencyMs: number; usage: { input_tokens: number; output_tokens: number; costUsd: number } } | { ok: false; code: "auth" | "offline" | "upstream"; error: string };

export async function decide(pilot: ModelPilot, bench: Bench, state: string, questions: Record<string, Question>): Promise<BenchResult> {
  const started = performance.now();
  const reply = await askModel(pilot, state, questions, bench === "chat" || bench === "carretera" ? "realtime" : "bench");
  if (!reply.ok) return reply;
  return { ok: true, model: reply.model, answers: packAnswers(reply.answers, questions), latencyMs: performance.now() - started, usage: reply.usage };
}
