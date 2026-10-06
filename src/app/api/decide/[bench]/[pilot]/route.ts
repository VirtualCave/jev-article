import { isModelPilot } from "@/lib/ai/pilots";
import { buildInput, type Bench } from "@/lib/bench/sets";
import { decide } from "@/lib/bench/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const benches = ["bandeja", "guardia", "chat", "carretera"];

export async function POST(request: Request, { params }: { params: Promise<{ bench: string; pilot: string }> }) {
  const { bench, pilot } = await params;
  if (!benches.includes(bench) || !isModelPilot(pilot)) return Response.json({ ok: false, code: "bad_request", error: "Benchmark o piloto inválido." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, code: "bad_request", error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ ok: false, code: "bad_request", error: "Petición inválida." }, { status: 400 });
  const input = buildInput(bench as Bench, body);
  if (!input) return Response.json({ ok: false, code: "bad_request", error: "Elemento inválido." }, { status: 400 });
  const result = await decide(pilot, bench as Bench, input.state, input.questions);
  return Response.json(result, { status: result.ok ? 200 : result.code === "auth" ? 401 : result.code === "offline" ? 503 : 502 });
}
