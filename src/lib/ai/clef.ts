import "server-only";

export async function predictLaya(state: unknown, questions: unknown, timeoutMs: number) {
  const url = process.env.LAYA_URL || "http://127.0.0.1:8765";
  try {
    const response = await fetch(`${url}/predict`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state, questions, lang: "en" }), signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!response.ok) return { ok: false as const, code: response.status === 503 ? "offline" as const : "upstream" as const, error: (await response.text()).slice(0, 280) || `Laya HTTP ${response.status}` };
    const data = await response.json() as { model: string; answers: Record<string, unknown>; usage?: { input_tokens: number; output_tokens?: number } };
    return { ok: true as const, ...data };
  } catch { return { ok: false as const, code: "offline" as const, error: "El sidecar de Laya no responde. Arráncalo con npm run laya." }; }
}
