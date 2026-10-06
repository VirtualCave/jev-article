type Probabilities = Record<string, number>;

/** TypeSafe's choice confidence: 0 for an even split, 1 for certainty. https://docs.typesafe.ai/confidence */
export function choiceConfidence(p: number[]) {
  return p.length > 1 ? Math.max(0, (Math.max(...p) - 1 / p.length) / (1 - 1 / p.length)) : 1;
}

/** TypeSafe's score confidence: mass far from the most likely level lowers it more than mass next to it. */
export function scoreConfidence(p: number[]) {
  const peak = p.indexOf(Math.max(...p));
  const spread = p.reduce((sum, value, level) => sum + value * Math.abs(level - peak), 0);
  const uniform = p.reduce((sum, _, level) => sum + Math.abs(level - peak), 0) / p.length;
  return uniform > 0 ? Math.max(0, 1 - spread / uniform) : 1;
}

/** Clef reports 1 − normalized Gini impurity and Laya 1 − normalized entropy as `confidence`; recompute it from the probabilities so thresholds mean the same as Jev's. */
export function withTypesafeConfidence(answers: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(answers).map(([key, value]) => {
    const answer = value as { type?: string; probabilities?: Probabilities };
    const probabilities = answer?.probabilities;
    if (!probabilities || (answer.type !== "choice" && answer.type !== "score")) return [key, value];
    if (answer.type === "choice") return [key, { ...answer, confidence: choiceConfidence(Object.values(probabilities)) }];
    const levels = Object.keys(probabilities).sort((a, b) => Number(a) - Number(b)).map(level => probabilities[level]);
    return [key, { ...answer, confidence: scoreConfidence(levels) }];
  }));
}
