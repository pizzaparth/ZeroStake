export interface Outcome {
  probability: number;
  /** Total return multiplier (1 = stake back, 0 = loss). */
  multiplier: number;
}

/** Σ P(outcome) × multiplier: the theoretical return to player. */
export function expectedReturn(outcomes: Outcome[]): number {
  return outcomes.reduce((sum, o) => sum + o.probability * o.multiplier, 0);
}

/** Expected profit per unit staked: RTP − 1. */
export function expectedValue(outcomes: Outcome[]): number {
  return expectedReturn(outcomes) - 1;
}

export function totalProbability(outcomes: Outcome[]): number {
  return outcomes.reduce((sum, o) => sum + o.probability, 0);
}
