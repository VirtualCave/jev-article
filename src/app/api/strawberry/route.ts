import { noul, type Questions } from "@typesafe-ai/sdk";
import { askModel, type ModelReply } from "@/lib/ai/models";
import { isModelPilot } from "@/lib/ai/pilots";
import { singleCorrect, truthCount } from "@/lib/strawberry/aggregate";
import { batchRequest, fanoutRequest, singleRequest } from "@/lib/strawberry/questions";
import { normalizeInput } from "@/lib/strawberry/input";
import type { BenchResult, Call, Mode, PerLetter } from "@/lib/strawberry/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Noul = { noul?: number };
const failure = (reply: Extract<ModelReply, { ok: false }>) => Response.json(reply, { status: reply.code === "auth" ? 401 : reply.code === "offline" ? 503 : 502 });

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, code: "bad_request", error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ ok: false, code: "bad_request", error: "Petición inválida." }, { status: 400 });
  const { mode, word, letter, pilot = "jev" } = body as Record<string, unknown>;
  const input = normalizeInput(word, letter);
  if (!input || !["single", "batch", "fanout", "warmup"].includes(String(mode)) || !isModelPilot(pilot)) return Response.json({ ok: false, code: "bad_request", error: "Usa una palabra de 1–24 letras, una sola letra objetivo y un piloto válido." }, { status: 400 });
  const ask = (req: { state: unknown; questions: Questions }) => askModel(pilot, req.state, req.questions, "strawberry");
  if (mode === "warmup") {
    const reply = await ask({ state: "warmup", questions: { ready: noul("Is this a warmup request?") } });
    return reply.ok ? Response.json({ ok: true, mode: "warmup" }) : failure(reply);
  }
  const { word: w, letter: l } = input;
  const truth = truthCount(w, l);
  const start = performance.now();
  let calls: Call[] = [], model = "", count = 0, inputTokens = 0, costUsd = 0;
  let probabilities: Record<string, number> | undefined, perLetter: PerLetter[] | undefined, softCount: number | undefined;
  if (mode === "single") {
    const reply = await ask(singleRequest(w, l));
    if (!reply.ok) return failure(reply);
    const answer = reply.answers.letter_count as { choice?: string; probabilities?: Record<string, number> } | undefined;
    model = reply.model;
    count = Number(answer?.choice);
    probabilities = answer?.probabilities;
    ({ input_tokens: inputTokens, costUsd } = reply.usage);
    const endMs = performance.now() - start;
    calls = [{ id: "single", label: "Consulta única", startMs: 0, endMs, latencyMs: endMs, inputTokens }];
  } else if (mode === "batch") {
    const reply = await ask(batchRequest(w, l));
    if (!reply.ok) return failure(reply);
    model = reply.model;
    perLetter = [...w].map((char, index) => { const p = Number((reply.answers[`pos_${index + 1}`] as Noul | undefined)?.noul ?? 0); return { index, char, noul: p, isTarget: p >= .5 }; });
    count = perLetter.filter(item => item.isTarget).length;
    softCount = perLetter.reduce((sum, item) => sum + item.noul, 0);
    ({ input_tokens: inputTokens, costUsd } = reply.usage);
    const endMs = performance.now() - start;
    calls = [{ id: "batch", label: `${w.length} preguntas`, startMs: 0, endMs, latencyMs: endMs, inputTokens }];
  } else {
    const results = await Promise.all([...w].map(async (char, index) => {
      const startMs = performance.now() - start;
      const reply = await ask(fanoutRequest(w, l, index));
      const endMs = performance.now() - start;
      return { index, char, reply, startMs, endMs };
    }));
    const failed = results.find(result => !result.reply.ok)?.reply;
    if (failed && !failed.ok) return failure(failed);
    const answered = results.flatMap(result => result.reply.ok ? [{ ...result, reply: result.reply }] : []);
    model = answered[0].reply.model;
    perLetter = answered.map(({ index, char, reply }) => { const p = Number((reply.answers.is_target as Noul | undefined)?.noul ?? 0); return { index, char, noul: p, isTarget: p >= .5 }; });
    count = perLetter.filter(item => item.isTarget).length;
    softCount = perLetter.reduce((sum, item) => sum + item.noul, 0);
    calls = answered.map(({ index, char, reply, startMs, endMs }) => ({ id: `pos_${index + 1}`, label: `${index + 1} · ${char}`, startMs, endMs, latencyMs: endMs - startMs, inputTokens: reply.usage.input_tokens }));
    inputTokens = calls.reduce((sum, call) => sum + call.inputTokens, 0);
    costUsd = answered.reduce((sum, { reply }) => sum + reply.usage.costUsd, 0);
  }
  const wallMs = performance.now() - start;
  const result: BenchResult = { ok: true, mode: mode as Mode, word: w, letter: l, model, wallMs, calls, count, truth, correct: mode === "single" ? singleCorrect(count, truth) : count === truth, probabilities, perLetter, softCount, usage: { inputTokens, costUsd } };
  return Response.json(result);
}
