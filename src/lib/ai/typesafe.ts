import "server-only";
import { TypeSafeClient } from "@typesafe-ai/sdk";

export type UseCase = "flappy" | "tetris" | "strawberry" | "health" | "bench" | "realtime";
export const CLIENT_SETTINGS = {
  flappy: { timeout: 1800, retry: { maxRetries: 0 } },
  tetris: { timeout: 12000, retry: { maxRetries: 1 } },
  strawberry: { timeout: 10000, retry: { maxRetries: 0 } },
  health: { timeout: 6000, retry: { maxRetries: 0 } },
  bench: { timeout: 8000, retry: { maxRetries: 0 } },
  realtime: { timeout: 1500, retry: { maxRetries: 0 } },
} as const;
const clients = new Map<UseCase, TypeSafeClient>();

export function jevClient(useCase: UseCase) {
  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key) return null;
  let client = clients.get(useCase);
  if (!client) {
    client = new TypeSafeClient({ apiKey: key, defaultModel: "jev-latest", ...CLIENT_SETTINGS[useCase] });
    clients.set(useCase, client);
  }
  return client;
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "El modelo no respondió.";
  // OpenRouter passes Cloudflare's overload error through as a raw JSON body.
  if (/\b529\b|inference failed/i.test(message)) return { ok: false as const, code: "upstream" as const, error: "El proveedor está saturado (HTTP 529). Vuelve a intentarlo." };
  return { ok: false as const, code: /401|402|api key|unauthor|credits/i.test(message) ? "auth" as const : "upstream" as const, error: message.slice(0, 300) };
}
