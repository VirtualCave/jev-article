import { jevClient } from "@/lib/ai/typesafe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let jevCache: { at: number; value: { ok: boolean; detail: string } } | null = null;

export async function GET() {
  const client = jevClient("health");
  if (!client) jevCache = null;
  if (client && (!jevCache || Date.now() - jevCache.at > 60_000)) {
    try { await client.models.list(); jevCache = { at: Date.now(), value: { ok: true, detail: "Jev listo" } }; }
    catch (error) { jevCache = { at: Date.now(), value: { ok: false, detail: error instanceof Error ? error.message : "Jev no responde" } }; }
  }
  let laya = { ok: false, detail: "Sidecar apagado. npm run laya" };
  try {
    const response = await fetch(`${process.env.LAYA_URL || "http://127.0.0.1:8765"}/health`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    const data = await response.json() as { ok?: boolean; ready?: boolean; detail?: string };
    laya = { ok: response.ok && Boolean(data.ok && data.ready), detail: data.detail || "Laya cargando" };
  } catch { /* the UI shows the sidecar as offline */ }
  return Response.json({ jev: client ? jevCache?.value : { ok: false, detail: "Añade TYPESAFE_API_KEY en .env.local y reinicia" }, laya });
}
