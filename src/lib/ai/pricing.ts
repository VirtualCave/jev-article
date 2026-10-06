/**
 * USD per million input tokens; output is free on all three hosted models.
 * Jev 1.13: https://docs.typesafe.ai/models · Clef and Clef-Flash on OpenRouter: https://openrouter.ai/cloudflare/clef
 */
export const USD_PER_MILLION_INPUT = { jev: 0.042, clef: 0.24, "clef-flash": 0.09 } as const;

export function inputCostUsd(pilot: keyof typeof USD_PER_MILLION_INPUT, inputTokens: number) {
  if (!Number.isFinite(inputTokens) || inputTokens <= 0) return 0;
  return (inputTokens / 1_000_000) * USD_PER_MILLION_INPUT[pilot];
}

export function formatUsd(amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return "$0";
  if (amount < 0.000001) return `$${amount.toExponential(2)}`;
  const digits = amount < 0.01 ? 6 : 4;
  const raw = amount.toFixed(digits);
  return `$${raw.replace(/0+$/, "").replace(/\.$/, "")}`;
}

export function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}
