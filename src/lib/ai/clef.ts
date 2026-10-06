import "server-only";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { CLIENT_SETTINGS, type UseCase } from "./typesafe";

/** OpenRouter serves Cloudflare's Clef models behind the same System One API as Jev: https://openrouter.ai/docs/guides/community/typesafe-sdk */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
export const CLEF_MODELS = { clef: "cloudflare/clef", "clef-flash": "cloudflare/clef-flash" } as const;
export type ClefPilot = keyof typeof CLEF_MODELS;
const clients = new Map<UseCase, TypeSafeClient>();

export function clefClient(useCase: UseCase) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  let client = clients.get(useCase);
  if (!client) {
    client = new TypeSafeClient({ apiKey: key, baseURL: OPENROUTER_BASE_URL, defaultModel: CLEF_MODELS.clef, ...CLIENT_SETTINGS[useCase] });
    clients.set(useCase, client);
  }
  return client;
}

/** The SDK's models.list() does not understand OpenRouter's shape, so health asks for the key's status instead. */
export async function openRouterKeyStatus() {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return { ok: false, detail: "Añade OPENROUTER_API_KEY en .env.local y reinicia" };
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/v1/key`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(6000), cache: "no-store" });
    return response.ok ? { ok: true, detail: "OpenRouter listo" } : { ok: false, detail: `OpenRouter rechaza la clave (HTTP ${response.status})` };
  } catch { return { ok: false, detail: "OpenRouter no responde" }; }
}
