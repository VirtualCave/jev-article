import type { TaggedPlacement } from "./questions";

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

export type ScoreAnswer = {
  type: "score";
  score: number;
  confidence: number;
};

export type NoulAnswer = {
  type: "noul";
  noul: number;
};

export type DecideAnswers = {
  playable_well?: ChoiceAnswer;
  stack_danger?: ScoreAnswer;
  clear_is_available?: NoulAnswer;
  burial_is_avoidable?: NoulAnswer;
};

export type TokenUsage = {
  input_tokens: number;
  output_tokens?: number;
  costUsd?: number;
};

export type SpendMeter = {
  costUsd: number;
  inputTokens: number;
  calls: number;
};

export type DecideOk = {
  ok: true;
  model: string;
  answers: DecideAnswers;
  usage?: TokenUsage;
  latencyMs: number;
};

export type DecideErr = {
  ok: false;
  error: string;
  code: "offline" | "auth" | "bad_request" | "upstream";
};

export type DecideResult = DecideOk | DecideErr;

export type MoveTrace = {
  source: "model" | "shortlist" | "policy";
  placement: TaggedPlacement;
  model?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  note: string;
  latencyMs?: number;
  decideMs?: number;
  usage?: TokenUsage;
};

export function composeMove(
  candidates: TaggedPlacement[],
  result: DecideResult | null,
): MoveTrace {
  const fallback = candidates[0];
  if (!fallback) {
    throw new Error("No legal placements");
  }

  if (!result || !result.ok) {
    return {
      source: "shortlist",
      placement: fallback,
      note: result?.error ?? "Sin respuesta del modelo. Se usa el mejor candidato del codigo.",
    };
  }

  const answers = result.answers;
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const chosenId = answers.playable_well?.choice;
  let move = (chosenId && byId.get(chosenId)) || fallback;
  let source: MoveTrace["source"] = chosenId && byId.has(chosenId) ? "model" : "shortlist";
  let note = source === "model" ? "Pozo elegido por el modelo." : "El modelo no nombro un candidato valido.";

  const confidence = answers.playable_well?.confidence ?? 0;
  const clearAvailable = (answers.clear_is_available?.noul ?? 0) > 0.72;
  const burialAvoidable = (answers.burial_is_avoidable?.noul ?? 0) > 0.72;

  if (clearAvailable && confidence < 0.5 && move.lines === 0) {
    const clearer = candidates.find((c) => c.lines > 0);
    if (clearer) {
      move = clearer;
      source = "policy";
      note = "Confianza baja y hay un cierre de fila. El codigo toma esa jugada.";
    }
  } else if (burialAvoidable && move.holesCreated > 0 && confidence < 0.62) {
    const clean = candidates.find((c) => c.holesCreated === 0);
    if (clean) {
      move = clean;
      source = "policy";
      note = "Confianza baja y hay una caida sin enterrar celdas. El codigo toma esa.";
    }
  }

  return {
    source,
    placement: move,
    model: result.model,
    confidence: answers.playable_well?.confidence,
    probabilities: answers.playable_well?.probabilities,
    note,
    latencyMs: result.latencyMs,
    usage: result.usage,
  };
}
