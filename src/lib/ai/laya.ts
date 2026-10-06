import "server-only";

export async function predictLaya(state: unknown, questions: unknown, timeoutMs: number) {
  const url = process.env.LAYA_URL || "http://127.0.0.1:8765";
  const signal = AbortSignal.timeout(timeoutMs);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`${url}/predict`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state, questions, lang: "en" }), signal, cache: "no-store" });
      if (!response.ok) return { ok: false as const, code: response.status === 503 ? "offline" as const : "upstream" as const, error: (await response.text()).slice(0, 280) || `Laya HTTP ${response.status}` };
      const data = await response.json() as { model: string; answers: Record<string, unknown>; usage?: { input_tokens: number; output_tokens?: number } };
      return { ok: true as const, ...data };
    } catch {
      // A burst of parallel calls can find the sidecar's accept queue full; predictions are idempotent, so retry a reset connection once.
      if (attempt === 0 && !signal.aborted) continue;
      return { ok: false as const, code: "offline" as const, error: "El sidecar de Laya no responde. Arráncalo con npm run laya." };
    }
  }
}

export async function layaStatus() {
  try {
    const response = await fetch(`${process.env.LAYA_URL || "http://127.0.0.1:8765"}/health`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    const data = await response.json() as { ok?: boolean; ready?: boolean; detail?: string };
    return { ok: response.ok && Boolean(data.ok && data.ready), detail: data.detail || "Laya cargando" };
  } catch { return { ok: false, detail: "Sidecar apagado. npm run laya" }; }
}
