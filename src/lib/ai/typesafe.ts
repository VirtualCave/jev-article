import "server-only";
import { TypeSafeClient } from "@typesafe-ai/sdk";

type UseCase = "flappy" | "tetris" | "strawberry" | "health" | "bench" | "realtime";
const settings = {
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
    client = new TypeSafeClient({ apiKey: key, defaultModel: "jev-latest", ...settings[useCase] });
    clients.set(useCase, client);
  }
  return client;
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "El modelo no respondió.";
  return { ok: false as const, code: /401|api key|unauthor/i.test(message) ? "auth" as const : "upstream" as const, error: message.slice(0, 300) };
}
