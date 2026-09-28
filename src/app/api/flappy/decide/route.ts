import { choice } from "@typesafe-ai/sdk";
import { apiError, jevClient } from "@/lib/ai/typesafe";
import { predictLaya } from "@/lib/ai/laya";
import { jevCostUsd } from "@/lib/ai/pricing";
import { describeWorld, mapAction, QUESTIONS, type FlightAnswers } from "@/lib/flappy/policy";
import type { Facts } from "@/lib/flappy/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validFacts(value: unknown): value is Facts {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["bird_y", "aim_y", "gap_y", "vy", "pipe_dx"].every(key => typeof record[key] === "number" && Number.isFinite(record[key]) && Math.abs(record[key] as number) <= 2);
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, code: "bad_request", error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ ok: false, code: "bad_request", error: "Petición inválida." }, { status: 400 });
  const { pilot, facts } = body as Record<string, unknown>;
  if ((pilot !== "jev" && pilot !== "laya") || !validFacts(facts)) return Response.json({ ok: false, code: "bad_request", error: "Datos de vuelo inválidos." }, { status: 400 });
  const state = describeWorld(facts);
  const started = performance.now();
  try {
    if (pilot === "laya") {
      const response = await predictLaya(state, QUESTIONS, 1800);
      if (!response.ok) return Response.json(response, { status: response.code === "offline" ? 503 : 502 });
      const answers = response.answers as FlightAnswers;
      return Response.json({ ok: true, ...mapAction(answers, facts), latencyMs: performance.now() - started, answers, usage: response.usage || { input_tokens: 0, output_tokens: 0, costUsd: 0 }, model: response.model, state });
    }
    const client = jevClient("flappy");
    if (!client) return Response.json({ ok: false, code: "auth", error: "Añade TYPESAFE_API_KEY en .env.local y reinicia." }, { status: 401 });
    const response = await client.systemOne({ state, questions: { relative_to_gap: choice(QUESTIONS.relative_to_gap.instructions, QUESTIONS.relative_to_gap.criteria) } });
    const answers = response.answers as FlightAnswers;
    const input = response.usage?.input_tokens ?? 0;
    return Response.json({ ok: true, ...mapAction(answers, facts), latencyMs: performance.now() - started, answers, usage: { input_tokens: input, output_tokens: response.usage?.output_tokens ?? 0, costUsd: jevCostUsd(input) }, model: response.model, state });
  } catch (error) { const result = apiError(error); return Response.json(result, { status: result.code === "auth" ? 401 : 502 }); }
}
