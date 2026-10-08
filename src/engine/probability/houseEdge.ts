/**
 * Core relationships used by every game:
 *   house edge = 1 − RTP
 *   fair multiplier = 1 / P(win)
 *   offered multiplier = RTP / P(win)
 */

export function houseEdge(rtp: number): number {
  return 1 - rtp;
}

export function multiplierForProbability(probability: number, rtp: number): number {
  if (probability <= 0) return 0;
  return rtp / probability;
}

/** Truncates (never rounds up), so displayed/paid multipliers can't exceed the target RTP. */
export function floorTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  // The epsilon absorbs binary noise like 1.98 * 100 = 197.99999999999997.
  return Math.floor(value * f + 1e-9) / f;
}

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
