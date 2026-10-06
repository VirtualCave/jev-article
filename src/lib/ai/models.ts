import "server-only";
import type { EntryType, Questions } from "@typesafe-ai/sdk";
import { CLEF_MODELS, clefClient } from "./clef";
import { withTypesafeConfidence } from "./confidence";
import { predictLaya } from "./laya";
import type { ModelPilot } from "./pilots";
import { inputCostUsd } from "./pricing";
import { apiError, jevClient, type UseCase } from "./typesafe";

export type ModelReply =
  | { ok: true; model: string; answers: Record<string, unknown>; usage: { input_tokens: number; output_tokens: number; costUsd: number } }
  | { ok: false; code: "auth" | "offline" | "upstream"; error: string };

/** Laya gets the same per-use-case patience as the hosted clients. */
const LAYA_TIMEOUT_MS: Record<UseCase, number> = { flappy: 1800, tetris: 20000, strawberry: 10000, health: 2500, bench: 8000, realtime: 1500 };

/** One typed decision from any pilot. Clef answers through OpenRouter's System One API, with the same body as Jev. */
export async function askModel(pilot: ModelPilot, state: unknown, questions: Questions, useCase: UseCase): Promise<ModelReply> {
  if (pilot === "laya") {
    const result = await predictLaya(state, questions, LAYA_TIMEOUT_MS[useCase]);
    if (!result.ok) return result;
    return { ok: true, model: result.model, answers: withTypesafeConfidence(result.answers), usage: { input_tokens: result.usage?.input_tokens ?? 0, output_tokens: result.usage?.output_tokens ?? 0, costUsd: 0 } };
  }
  const client = pilot === "jev" ? jevClient(useCase) : clefClient(useCase);
  if (!client) return { ok: false, code: "auth", error: pilot === "jev" ? "Añade TYPESAFE_API_KEY en .env.local y reinicia." : "Añade OPENROUTER_API_KEY en .env.local y reinicia." };
  try {
    const response = await client.systemOne({ state: state as EntryType, questions, ...(pilot === "jev" ? {} : { model: CLEF_MODELS[pilot] }) });
    const usage = response.usage as { input_tokens?: number; output_tokens?: number; cost?: number };
    const input = usage.input_tokens ?? 0;
    const answers = response.answers as Record<string, unknown>;
    return {
      ok: true,
      model: response.model,
      // Clef and Laya define confidence on other scales; recompute it with TypeSafe's definition.
      answers: pilot === "jev" ? answers : withTypesafeConfidence(answers),
      // OpenRouter bills Clef and returns the cost; Jev's direct API only returns tokens.
      usage: { input_tokens: input, output_tokens: usage.output_tokens ?? 0, costUsd: typeof usage.cost === "number" ? usage.cost : inputCostUsd(pilot, input) },
    };
  } catch (error) { return apiError(error); }
}
