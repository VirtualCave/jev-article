import { packAnswers } from "@/lib/ai/http";
import { askModel } from "@/lib/ai/models";
import { isModelPilot } from "@/lib/ai/pilots";
import type { DecisionQuestions, DecisionState } from "@/lib/ai/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const keys = ["playable_well", "stack_danger", "clear_is_available", "burial_is_avoidable"];
function valid(body: unknown): body is { state: DecisionState; questions: DecisionQuestions } {
  if (!body || typeof body !== "object") return false;
  const { state, questions } = body as Record<string, unknown>;
  if (!state || typeof state !== "object" || !questions || typeof questions !== "object") return false;
  const s = state as Record<string, unknown>, q = questions as Record<string, unknown>;
  if (keys.length !== Object.keys(q).length || !keys.every(k => k in q)) return false;
  if (!["falling_piece", "next_piece", "current_well"].every(k => typeof s[k] === "string" && (s[k] as string).length <= 180)) return false;
  const wells = s.candidate_wells;
  if (!wells || typeof wells !== "object") return false;
  const candidates = Object.entries(wells);
  if (candidates.length < 1 || candidates.length > 5 || !candidates.every(([k, v]) => /^p[0-4]$/.test(k) && typeof v === "string" && v.length <= 180)) return false;
  const playable = q.playable_well as Record<string, unknown>;
  if (!playable || playable.type !== "choice" || !playable.criteria || JSON.stringify(playable.criteria) !== JSON.stringify(wells)) return false;
  if (!keys.every(k => { const item = q[k] as Record<string, unknown>; return item && typeof item.instructions === "string" && item.instructions.length <= 180; })) return false;
  const danger = q.stack_danger as Record<string, unknown>;
  if (danger.type !== "score" || !Array.isArray(danger.criteria) || danger.criteria.length !== 4 || !danger.criteria.every(value => typeof value === "string" && value.length <= 180)) return false;
  return ["clear_is_available", "burial_is_avoidable"].every(key => { const item = q[key] as Record<string, unknown>, criteria = item.criteria as Record<string, unknown> | undefined; return item.type === "noul" && criteria && typeof criteria.true === "string" && criteria.true.length <= 180 && typeof criteria.false === "string" && criteria.false.length <= 180; });
}

export async function POST(request: Request, { params }: { params: Promise<{ player: string }> }) {
  const { player } = await params;
  if (!isModelPilot(player)) return Response.json({ ok: false, code: "bad_request", error: "Piloto inválido." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, code: "bad_request", error: "JSON inválido." }, { status: 400 }); }
  if (!valid(body)) return Response.json({ ok: false, code: "bad_request", error: "Petición de Tetris inválida." }, { status: 400 });
  const started = performance.now();
  const reply = await askModel(player, body.state, body.questions, "tetris");
  if (!reply.ok) return Response.json(reply, { status: reply.code === "auth" ? 401 : reply.code === "offline" ? 503 : 502 });
  return Response.json({ ok: true, model: reply.model, answers: packAnswers(reply.answers), usage: reply.usage, latencyMs: performance.now() - started });
}
