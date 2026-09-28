import type { Question } from "@typesafe-ai/sdk";
import type { ChoiceAnswer, DecideAnswers, NoulAnswer, ScoreAnswer } from "./compose";

export type PackedAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer;
const tetrisQuestions: Record<string, { type: Question["type"] }> = { playable_well: { type: "choice" }, stack_danger: { type: "score" }, clear_is_available: { type: "noul" }, burial_is_avoidable: { type: "noul" } };

export function packAnswers(raw: Record<string, unknown>): DecideAnswers;
export function packAnswers(raw: Record<string, unknown>, questions: Record<string, Question>): Record<string, PackedAnswer>;
export function packAnswers(raw: Record<string, unknown>, questions: Record<string, { type: Question["type"] }> = tetrisQuestions): DecideAnswers | Record<string, PackedAnswer> {
  const result: Record<string, PackedAnswer> = {};
  const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
  for (const [key, question] of Object.entries(questions)) {
    const value = raw[key];
    if (!value || typeof value !== "object") continue;
    const answer = value as Record<string, unknown>;
    if (question.type === "choice") {
      const probabilities = Object.fromEntries(Object.entries((answer.probabilities && typeof answer.probabilities === "object" ? answer.probabilities : {}) as Record<string, unknown>).filter(([, p]) => typeof p === "number" && Number.isFinite(p)));
      result[key] = { type: "choice", choice: String(answer.choice ?? ""), confidence: finite(answer.confidence), probabilities: probabilities as Record<string, number> };
    } else if (question.type === "score") result[key] = { type: "score", score: finite(answer.score), confidence: finite(answer.confidence) };
    else result[key] = { type: "noul", noul: finite(answer.noul) };
  }
  return result;
}
