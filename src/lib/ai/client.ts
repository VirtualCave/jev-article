import type { DecideResult } from "./compose";
import type { DecisionQuestions, DecisionState } from "./questions";

export async function requestDecision(
  player: "jev" | "laya",
  state: DecisionState,
  questions: DecisionQuestions,
  signal?: AbortSignal,
): Promise<DecideResult> {
  const res = await fetch(`/api/tetris/decide/${player}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state, questions }),
    signal,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    return { ok: false, code: "upstream", error: "Respuesta ilegible del servidor." };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, code: "upstream", error: "Respuesta vacia del servidor." };
  }

  return data as DecideResult;
}

export type Health = {
  jev: { ok: boolean; detail: string };
  laya: { ok: boolean; detail: string };
};

export async function fetchHealth(): Promise<Health> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) {
      return {
        jev: { ok: false, detail: "Health fallido" },
        laya: { ok: false, detail: "Health fallido" },
      };
    }
    return (await res.json()) as Health;
  } catch {
    return {
      jev: { ok: false, detail: "Sin conexion" },
      laya: { ok: false, detail: "Sin conexion" },
    };
  }
}
