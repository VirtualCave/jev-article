import type { BenchAnswer } from "./server";

const unit = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function prediction(answer: BenchAnswer | undefined): { value: string | number | boolean; confidence: number } | null {
  if (!answer) return null;
  if (answer.type === "choice") {
    const probability = answer.probabilities[answer.choice];
    return { value: answer.choice, confidence: unit(typeof probability === "number" ? probability : answer.confidence) };
  }
  if (answer.type === "score") return { value: Math.max(0, Math.min(3, Math.round(answer.score))), confidence: unit(answer.confidence) };
  const probability = unit(answer.noul);
  return { value: probability >= .5, confidence: Math.max(probability, 1 - probability) };
}
