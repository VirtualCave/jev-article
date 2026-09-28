import "server-only";
import type { Question } from "@typesafe-ai/sdk";
import { apiError, jevClient } from "@/lib/ai/typesafe";
import { predictLaya } from "@/lib/ai/laya";
import { jevCostUsd } from "@/lib/ai/pricing";
import { packAnswers, type PackedAnswer } from "@/lib/ai/http";
import type { Bench } from "./sets";

export type BenchAnswer = PackedAnswer;
export type BenchResult = { ok: true; model: string; answers: Record<string, BenchAnswer>; latencyMs: number; usage: { input_tokens: number; output_tokens: number; costUsd: number } } | { ok: false; code: "auth" | "offline" | "upstream"; error: string };

export async function decide(pilot: "jev" | "laya", bench: Bench, state: string, questions: Record<string, Question>): Promise<BenchResult> {
  const started = performance.now();
  if (pilot === "laya") {
    const result = await predictLaya(state, questions, bench === "chat" || bench === "carretera" ? 1500 : 8000);
    if (!result.ok) return result;
    return { ok: true, model: result.model, answers: packAnswers(result.answers, questions), latencyMs: performance.now() - started, usage: { input_tokens: result.usage?.input_tokens ?? 0, output_tokens: result.usage?.output_tokens ?? 0, costUsd: 0 } };
  }
  const client = jevClient(bench === "chat" || bench === "carretera" ? "realtime" : "bench");
  if (!client) return { ok: false, code: "auth", error: "Añade TYPESAFE_API_KEY en .env.local y reinicia." };
  try {
    const result = await client.systemOne({ state, questions });
    const input = result.usage?.input_tokens ?? 0;
    return { ok: true, model: result.model, answers: packAnswers(result.answers as Record<string, unknown>, questions), latencyMs: performance.now() - started, usage: { input_tokens: input, output_tokens: result.usage?.output_tokens ?? 0, costUsd: jevCostUsd(input) } };
  } catch (error) { return apiError(error); }
}
