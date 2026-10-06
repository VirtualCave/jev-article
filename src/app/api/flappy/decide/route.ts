import { askModel } from "@/lib/ai/models";
import { isModelPilot } from "@/lib/ai/pilots";
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
  if (!isModelPilot(pilot) || !validFacts(facts)) return Response.json({ ok: false, code: "bad_request", error: "Datos de vuelo inválidos." }, { status: 400 });
  const state = describeWorld(facts);
  const started = performance.now();
  const reply = await askModel(pilot, state, QUESTIONS, "flappy");
  if (!reply.ok) return Response.json(reply, { status: reply.code === "auth" ? 401 : reply.code === "offline" ? 503 : 502 });
  const answers = reply.answers as FlightAnswers;
  return Response.json({ ok: true, ...mapAction(answers, facts), latencyMs: performance.now() - started, answers, usage: reply.usage, model: reply.model, state });
}
