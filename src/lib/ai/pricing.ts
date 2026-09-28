/** Jev 1.13: charged per input token. Output is free. https://docs.typesafe.ai/models */
export const JEV_USD_PER_MILLION_INPUT = 0.042;

export function jevCostUsd(inputTokens: number) {
  if (!Number.isFinite(inputTokens) || inputTokens <= 0) return 0;
  return (inputTokens / 1_000_000) * JEV_USD_PER_MILLION_INPUT;
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
