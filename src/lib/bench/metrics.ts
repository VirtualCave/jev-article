export type Prediction = { predicted: string | number | boolean; truth: string | number | boolean; confidence: number };
export const accuracy = (items: Prediction[]) => items.length ? items.filter(item => item.predicted === item.truth).length / items.length : 0;

export function confusion(items: Prediction[], positive: string | number | boolean = true) {
  return items.reduce((counts, item) => {
    if (item.truth === positive) { if (item.predicted === positive) counts.tp++; else counts.fn++; }
    else { if (item.predicted === positive) counts.fp++; else counts.tn++; }
    return counts;
  }, { tp: 0, fp: 0, tn: 0, fn: 0 });
}

export function coverageCurve(items: Prediction[]) {
  return Array.from({ length: 21 }, (_, index) => {
    const threshold = index / 20;
    const selected = items.filter(item => item.confidence >= threshold);
    return { threshold, coverage: items.length ? selected.length / items.length : 0, accuracy: selected.length ? accuracy(selected) : null };
  });
}

export function reliability(items: Prediction[], bands = 10) {
  return Array.from({ length: bands }, (_, index) => {
    const selected = items.filter(item => Math.min(bands - 1, Math.floor(item.confidence * bands)) === index);
    return { from: index / bands, to: (index + 1) / bands, count: selected.length, confidence: selected.length ? selected.reduce((sum, item) => sum + item.confidence, 0) / selected.length : null, accuracy: selected.length ? accuracy(selected) : null };
  });
}

export function ece(items: Prediction[], bands = 10) {
  return items.length ? reliability(items, bands).reduce((sum, band) => sum + (band.count / items.length) * Math.abs((band.accuracy ?? 0) - (band.confidence ?? 0)), 0) : 0;
}

export function brier(items: { probability: number; positive: boolean }[]) {
  return items.length ? items.reduce((sum, item) => sum + (item.probability - Number(item.positive)) ** 2, 0) / items.length : 0;
}

export function auroc(items: { score: number; positive: boolean }[]) {
  const positives = items.filter(item => item.positive);
  const negatives = items.filter(item => !item.positive);
  if (!positives.length || !negatives.length) return null;
  let wins = 0;
  for (const good of positives) for (const bad of negatives) wins += good.score === bad.score ? .5 : good.score > bad.score ? 1 : 0;
  return wins / (positives.length * negatives.length);
}

export function recallAtFpr(items: { score: number; positive: boolean }[], maxFpr: number) {
  const positives = items.filter(item => item.positive).length;
  const negatives = items.length - positives;
  if (!positives || !negatives) return null;
  let tp = 0, fp = 0, best = 0;
  for (const item of [...items].sort((a, b) => b.score - a.score)) {
    if (item.positive) tp++; else fp++;
    if (fp / negatives <= maxFpr) best = Math.max(best, tp / positives);
  }
  return best;
}

export function meanAbsoluteError(items: { predicted: number; truth: number }[]) {
  return items.length ? items.reduce((sum, item) => sum + Math.abs(item.predicted - item.truth), 0) / items.length : 0;
}

export function majorityBaseline(values: (string | number | boolean)[]) {
  if (!values.length) return 0;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  return Math.max(...counts.values()) / values.length;
}

export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(0, Math.min(1, p)) * (sorted.length - 1);
  const low = Math.floor(rank), high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

export type CascadeItem = { laya: Prediction; jev?: Prediction; layaMs: number; jevMs?: number; jevCostUsd?: number };
export function cascade(items: CascadeItem[], thresholdA: number, thresholdB: number) {
  const counts = { laya: 0, jev: 0, human: 0, correct: 0, automated: 0, costUsd: 0, latencyMs: 0 };
  for (const item of items) {
    counts.latencyMs += item.layaMs;
    if (item.laya.confidence >= thresholdA) {
      counts.laya++; counts.automated++;
      if (item.laya.predicted === item.laya.truth) counts.correct++;
    } else if (item.jev) {
      counts.latencyMs += item.jevMs ?? 0;
      counts.costUsd += item.jevCostUsd ?? 0;
      if (item.jev.confidence >= thresholdB) {
        counts.jev++; counts.automated++;
        if (item.jev.predicted === item.jev.truth) counts.correct++;
      } else counts.human++;
    } else counts.human++;
  }
  return { ...counts, automatedAccuracy: counts.automated ? counts.correct / counts.automated : 0, estimatedFinalAccuracy: items.length ? (counts.correct + counts.human) / items.length : 0, meanModelLatencyMs: items.length ? counts.latencyMs / items.length : 0 };
}

export function maxSustainableRate(samples: { rate: number; p95Ms: number; pending: number; dropped?: number }[], limitMs = 2000) {
  let best = 0;
  for (const sample of [...samples].sort((a, b) => a.rate - b.rate)) {
    const held = sample.p95Ms <= limitMs && sample.pending <= sample.rate * 2 && !(sample.dropped && sample.dropped > 0);
    if (held) best = sample.rate;
    else break;
  }
  return best;
}
