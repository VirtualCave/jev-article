import { formatMs } from "../ai/pricing";
import { MODE_META, MODES } from "./modes";
import type { BenchResult, Mode } from "./types";

export const truthCount = (word: string, letter: string) => [...word].filter(char => char === letter).length;
export const singleCorrect = (count: number, truth: number) => count === truth || (count === 5 && truth >= 5);

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
};

type Timed = { wallMs: number; usage: { inputTokens: number; costUsd: number } };

export type ModeStats = {
  medianMs: number;
  minMs: number;
  maxMs: number;
  p25Ms: number;
  p75Ms: number;
  meanTokens: number;
  medianTokens: number;
  minTokens: number;
  maxTokens: number;
  p25Tokens: number;
  p75Tokens: number;
  meanCostUsd: number;
  correct: number;
  total: number;
  accuracy: number;
};

export function summarize(values: Timed[]): Omit<ModeStats, "correct" | "total" | "accuracy"> {
  if (!values.length) {
    return { medianMs: 0, minMs: 0, maxMs: 0, p25Ms: 0, p75Ms: 0, meanTokens: 0, medianTokens: 0, minTokens: 0, maxTokens: 0, p25Tokens: 0, p75Tokens: 0, meanCostUsd: 0 };
  }
  const times = values.map(value => value.wallMs);
  const tokens = values.map(value => value.usage.inputTokens);
  return {
    medianMs: median(times),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    p25Ms: percentile(times, 0.25),
    p75Ms: percentile(times, 0.75),
    meanTokens: tokens.reduce((sum, value) => sum + value, 0) / tokens.length,
    medianTokens: median(tokens),
    minTokens: Math.min(...tokens),
    maxTokens: Math.max(...tokens),
    p25Tokens: percentile(tokens, 0.25),
    p75Tokens: percentile(tokens, 0.75),
    meanCostUsd: values.reduce((sum, value) => sum + value.usage.costUsd, 0) / values.length,
  };
}

export function modeStats(samples: BenchResult[]): ModeStats | null {
  if (!samples.length) return null;
  const correct = samples.filter(sample => sample.correct).length;
  return { ...summarize(samples), correct, total: samples.length, accuracy: correct / samples.length };
}

const NEARLY_SAME = 1.08;
const NAME = {
  single: { subject: "La consulta de recuento", object: "la consulta de recuento", fue: "fue", rapido: "más rápida", tan: "casi tan rápida como" },
  batch: { subject: "Agrupar N preguntas en una consulta", object: "agrupar N preguntas en una consulta", fue: "fue", rapido: "más rápido", tan: "casi tan rápido como" },
  fanout: { subject: "N consultas simultáneas", object: "N consultas simultáneas", fue: "fueron", rapido: "más rápidas", tan: "casi tan rápidas como" },
} as const;

function prettyRatio(ratio: number) {
  const digits = ratio >= 10 ? 0 : ratio >= 2 ? 1 : 2;
  return ratio.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function tokenDelta(winner: number, other: number) {
  const diff = Math.round(other - winner);
  if (Math.abs(diff) < 2) return "gastó los mismos tokens";
  return diff > 0 ? `gastó ${diff} tokens menos` : `gastó ${Math.abs(diff)} tokens más`;
}

function accuracyClause(a: ModeStats, b: ModeStats, allTied: boolean) {
  if (allTied) return `con el mismo acierto (${a.correct}/${a.total})`;
  if (a.accuracy === b.accuracy) return `con acierto ${a.correct}/${a.total} en esas dos`;
  return `pero el acierto no coincidió (${a.correct}/${a.total} frente a ${b.correct}/${b.total})`;
}

function timeClause(winner: Mode, loser: Mode, winnerMs: number, loserMs: number) {
  const ratio = loserMs / Math.max(1, winnerMs);
  const name = NAME[winner];
  if (ratio < NEARLY_SAME) return `${name.subject} ${name.fue} ${name.tan} ${NAME[loser].object}`;
  return `${name.subject} ${name.fue} ${prettyRatio(ratio)} veces ${name.rapido} que ${NAME[loser].object}`;
}

function pickMin(stats: Record<Mode, ModeStats>, value: (stats: ModeStats) => number) {
  const floor = Math.min(...MODES.map(mode => value(stats[mode])));
  return MODES.filter(mode => Math.abs(value(stats[mode]) - floor) < 0.51);
}

function pickMax(stats: Record<Mode, ModeStats>, value: (stats: ModeStats) => number) {
  const ceil = Math.max(...MODES.map(mode => value(stats[mode])));
  return MODES.filter(mode => Math.abs(value(stats[mode]) - ceil) < 0.0005);
}

function overlap(a: { p25Ms: number; p75Ms: number }, b: { p25Ms: number; p75Ms: number }) {
  return a.p25Ms <= b.p75Ms && b.p25Ms <= a.p75Ms;
}

function listTitles(modes: Mode[]) {
  if (modes.length === 3) return "las tres estrategias";
  if (modes.length === 2) return `${MODE_META[modes[0]].title} y ${MODE_META[modes[1]].title}`;
  return MODE_META[modes[0]].title;
}

export type Verdict = {
  stats: Record<Mode, ModeStats>;
  fastest: Mode[];
  cheapest: Mode[];
  mostAccurate: Mode[];
  headline: string;
  warnings: string[];
  notes: string[];
  accuracyTied: boolean;
};

export function buildVerdict(samples: Record<Mode, BenchResult[]>): Verdict | null {
  const stats = Object.fromEntries(MODES.map(mode => [mode, modeStats(samples[mode])])) as Record<Mode, ModeStats | null>;
  if (!stats.single || !stats.batch || !stats.fanout) return null;
  const ready = stats as Record<Mode, ModeStats>;
  const fastest = pickMin(ready, item => item.medianMs);
  const cheapest = pickMin(ready, item => item.medianTokens);
  const mostAccurate = pickMax(ready, item => item.accuracy);
  const accuracyTied = ready.single.accuracy === ready.batch.accuracy && ready.batch.accuracy === ready.fanout.accuracy;
  const batchFaster = ready.batch.medianMs <= ready.fanout.medianMs;
  const winner = batchFaster ? "batch" : "fanout";
  const loser = batchFaster ? "fanout" : "batch";
  const pair = `${timeClause(winner, loser, ready[winner].medianMs, ready[loser].medianMs)} y ${tokenDelta(ready[winner].medianTokens, ready[loser].medianTokens)}, ${accuracyClause(ready[winner], ready[loser], accuracyTied)}.`;

  const timeMs = formatMs(ready[fastest[0]].medianMs);
  const tokenN = Math.round(ready[cheapest[0]].medianTokens);
  let winners: string;
  if (fastest.length === 3 && cheapest.length === 3) {
    winners = `En mediana, las tres tardaron casi lo mismo (${timeMs}) y gastaron unos ${tokenN} tokens.`;
  } else if (fastest.length === 1 && cheapest.length === 1 && fastest[0] === cheapest[0]) {
    winners = `En mediana, ${MODE_META[fastest[0]].title} ganó en tiempo (${timeMs}) y en tokens (${tokenN}).`;
  } else {
    const timePart = fastest.length === 1
      ? `${MODE_META[fastest[0]].title} ganó en tiempo (${timeMs})`
      : `el tiempo quedó en empate entre ${listTitles(fastest)} (${timeMs})`;
    const tokenPart = cheapest.length === 1
      ? `${MODE_META[cheapest[0]].title} gastó menos tokens (${tokenN})`
      : `los tokens quedaron en empate entre ${listTitles(cheapest)} (${tokenN})`;
    winners = `En mediana, ${timePart}; ${tokenPart}.`;
  }

  let accuracyLine: string;
  if (accuracyTied) {
    accuracyLine = `Las tres acertaron ${ready.single.correct} de ${ready.single.total}.`;
  } else if (mostAccurate.length === 1) {
    accuracyLine = `El mejor acierto fue ${MODE_META[mostAccurate[0]].title} (${ready[mostAccurate[0]].correct}/${ready[mostAccurate[0]].total}).`;
  } else {
    accuracyLine = `El mejor acierto lo compartieron ${listTitles(mostAccurate)} (${ready[mostAccurate[0]].correct}/${ready[mostAccurate[0]].total}).`;
  }

  const warnings: string[] = [];
  const notes: string[] = [];
  const rounds = ready.single.total;

  if (!accuracyTied) {
    warnings.push("El acierto no es el mismo en las tres estrategias. Comparar solo el tiempo o los tokens no es justo: no están resolviendo igual de bien el recuento.");
  }
  if (ready.single.accuracy < Math.max(ready.batch.accuracy, ready.fanout.accuracy)) {
    notes.push("Descomponer por letra acertó más que preguntar el total. La consulta de recuento es más barata, pero aquí no es un atajo equivalente.");
  }
  if (ready.fanout.accuracy < ready.batch.accuracy) {
    notes.push("N consultas simultáneas acertaron menos que las N preguntas en una sola petición. Paralelizar no copia el mismo juicio.");
  }
  if (samples.single.some(sample => sample.truth >= 5)) {
    notes.push("La consulta de recuento trata 5 como «cinco o más». Si la letra aparece 5 veces o más, un 5 cuenta como acierto aunque el total exacto sea mayor.");
  }
  if (rounds === 1) {
    notes.push("Con una sola ronda no hay dispersión: la mediana coincide con el único valor medido.");
  } else if (rounds >= 3 && overlap(ready.batch, ready.fanout) && Math.max(ready.batch.medianMs, ready.fanout.medianMs) / Math.max(1, Math.min(ready.batch.medianMs, ready.fanout.medianMs)) >= NEARLY_SAME) {
    notes.push("Los intervalos p25-p75 de tiempo de N preguntas juntas y N consultas simultáneas se solapan. Con estas rondas, la diferencia de medianas puede ser ruido.");
  }

  return {
    stats: ready,
    fastest,
    cheapest,
    mostAccurate,
    headline: `${pair} ${winners} ${accuracyLine}`,
    warnings,
    notes,
    accuracyTied,
  };
}
