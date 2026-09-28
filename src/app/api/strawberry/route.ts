import { noul } from "@typesafe-ai/sdk";
import { apiError, jevClient } from "@/lib/ai/typesafe";
import { jevCostUsd } from "@/lib/ai/pricing";
import { singleCorrect, truthCount } from "@/lib/strawberry/aggregate";
import { batchRequest, fanoutRequest, singleRequest } from "@/lib/strawberry/questions";
import { normalizeInput } from "@/lib/strawberry/input";
import type { BenchResult, Call, Mode, PerLetter } from "@/lib/strawberry/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, code: "bad_request", error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ ok: false, code: "bad_request", error: "Petición inválida." }, { status: 400 });
  const { mode, word, letter } = body as Record<string, unknown>;
  const input = normalizeInput(word, letter);
  if (!input || !["single", "batch", "fanout", "warmup"].includes(String(mode))) return Response.json({ ok: false, code: "bad_request", error: "Usa una palabra de 1–24 letras y una sola letra objetivo." }, { status: 400 });
  const client = jevClient("strawberry");
  if (!client) return Response.json({ ok: false, code: "auth", error: "Añade TYPESAFE_API_KEY en .env.local y reinicia." }, { status: 401 });
  try {
    if (mode === "warmup") { await client.systemOne({ state: "warmup", questions: { ready: noul("Is this a warmup request?") } }); return Response.json({ ok: true, mode: "warmup" }); }
    const { word: w, letter: l } = input;
    const truth = truthCount(w, l);
    const start = performance.now();
    let calls: Call[] = [], model = "jev-latest", count = 0, inputTokens = 0;
    let probabilities: Record<string, number> | undefined, perLetter: PerLetter[] | undefined, softCount: number | undefined;
    if (mode === "single") {
      const response = await client.systemOne(singleRequest(w, l));
      model = response.model;
      count = Number(response.answers.letter_count.choice);
      probabilities = response.answers.letter_count.probabilities;
      inputTokens = response.usage.input_tokens;
      const endMs = performance.now() - start;
      calls = [{ id: "single", label: "Consulta única", startMs: 0, endMs, latencyMs: endMs, inputTokens }];
    } else if (mode === "batch") {
      const response = await client.systemOne(batchRequest(w, l));
      model = response.model;
      perLetter = [...w].map((char, index) => ({ index, char, noul: Number(response.answers[`pos_${index + 1}`]?.noul ?? 0), isTarget: Number(response.answers[`pos_${index + 1}`]?.noul ?? 0) >= .5 }));
      count = perLetter.filter(item => item.isTarget).length;
      softCount = perLetter.reduce((sum, item) => sum + item.noul, 0);
      inputTokens = response.usage.input_tokens;
      const endMs = performance.now() - start;
      calls = [{ id: "batch", label: `${w.length} preguntas`, startMs: 0, endMs, latencyMs: endMs, inputTokens }];
    } else {
      const results = await Promise.all([...w].map(async (char, index) => {
        const startMs = performance.now() - start;
        const response = await client.systemOne(fanoutRequest(w, l, index));
        const endMs = performance.now() - start;
        return { index, char, response, call: { id: `pos_${index + 1}`, label: `${index + 1} · ${char}`, startMs, endMs, latencyMs: endMs - startMs, inputTokens: response.usage.input_tokens } };
      }));
      model = results[0].response.model;
      perLetter = results.map(({ index, char, response }) => ({ index, char, noul: response.answers.is_target.noul, isTarget: response.answers.is_target.noul >= .5 }));
      count = perLetter.filter(item => item.isTarget).length;
      softCount = perLetter.reduce((sum, item) => sum + item.noul, 0);
      calls = results.map(result => result.call);
      inputTokens = calls.reduce((sum, call) => sum + call.inputTokens, 0);
    }
    const wallMs = performance.now() - start;
    const result: BenchResult = { ok: true, mode: mode as Mode, word: w, letter: l, model, wallMs, calls, count, truth, correct: mode === "single" ? singleCorrect(count, truth) : count === truth, probabilities, perLetter, softCount, usage: { inputTokens, costUsd: jevCostUsd(inputTokens) } };
    return Response.json(result);
  } catch (error) { const result = apiError(error); return Response.json(result, { status: result.code === "auth" ? 401 : 502 }); }
}
