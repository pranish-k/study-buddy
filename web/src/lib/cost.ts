import type { Usage } from './api';

/** USD per million tokens. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
};

/** Returns the estimated cost in USD, or null when the model's price is unknown. */
export function estimateCost(usage: Usage, model: string): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}

export function formatUsd(amount: number): string {
  return amount < 0.01 && amount > 0 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}
