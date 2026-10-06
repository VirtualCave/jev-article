import { openRouterKeyStatus } from "@/lib/ai/clef";
import { layaStatus } from "@/lib/ai/laya";
import { jevClient } from "@/lib/ai/typesafe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = { ok: boolean; detail: string };
let jevCache: { at: number; value: Status } | null = null;
let openRouterCache: { at: number; value: Status } | null = null;

export async function GET() {
  const client = jevClient("health");
  if (!client) jevCache = null;
  if (client && (!jevCache || Date.now() - jevCache.at > 60_000)) {
    try { await client.models.list(); jevCache = { at: Date.now(), value: { ok: true, detail: "Jev listo" } }; }
    catch (error) { jevCache = { at: Date.now(), value: { ok: false, detail: error instanceof Error ? error.message : "Jev no responde" } }; }
  }
  if (!process.env.OPENROUTER_API_KEY?.trim()) openRouterCache = null;
  if (!openRouterCache || Date.now() - openRouterCache.at > 60_000) openRouterCache = { at: Date.now(), value: await openRouterKeyStatus() };
  const openRouter = openRouterCache.value;
  const viaOpenRouter = (label: string) => openRouter.ok ? { ok: true, detail: `${label} vía OpenRouter` } : openRouter;
  return Response.json({
    jev: client ? jevCache?.value : { ok: false, detail: "Añade TYPESAFE_API_KEY en .env.local y reinicia" },
    clef: viaOpenRouter("Clef"),
    "clef-flash": viaOpenRouter("Clef-Flash"),
    laya: await layaStatus(),
  });
}
