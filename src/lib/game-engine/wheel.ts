import { generateOutcome } from "./rng";

/**
 * Wheel — a ring of segments, each carrying a multiplier. The wheel spins to a
 * random segment. Risk shapes the payout profile (low = frequent small wins,
 * high = rare large wins). Each base ring is 10 long and tiled to the chosen
 * segment count (10/20/30/40/50), so probabilities are identical across sizes.
 *
 * Each base ring is tuned to ~0.96–0.97 RTP.
 */

export type WheelRisk = "low" | "medium" | "high";
export type WheelSegments = 10 | 20 | 30 | 40 | 50;

const BASE_RINGS: Record<WheelRisk, number[]> = {
  //                                                            RTP
  low:    [1.5, 1.2, 1.5, 0, 1.2, 1.5, 1.2, 0, 1.5, 0],     // 0.96
  medium: [1.5, 0, 3, 0, 1.8, 0, 1.5, 0, 1.8, 0],           // 0.96
  high:   [0, 0, 0, 0, 8, 0, 0, 0, 1.7, 0],                 // 0.97
};

export interface WheelResult {
  segmentIndex: number;
  multiplier: number;
  profit: bigint;
}

/** The full multiplier ring for a given size + risk (length = segments). */
export function getWheelRing(segments: WheelSegments, risk: WheelRisk): number[] {
  const base = BASE_RINGS[risk];
  const reps = segments / base.length; // 10/20/30/40/50 ÷ 10
  const ring: number[] = [];
  for (let i = 0; i < reps; i++) ring.push(...base);
  return ring;
}

export function resolveWheel(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  betAmount: bigint,
  segments: WheelSegments,
  risk: WheelRisk
): WheelResult {
  const ring = getWheelRing(segments, risk);
  const r = generateOutcome(serverSeed, clientSeed, nonce);
  const segmentIndex = Math.min(ring.length - 1, Math.floor(r * ring.length));
  const multiplier = ring[segmentIndex];

  // profit is negative when multiplier < 1 (0× = full loss)
  const profit = BigInt(Math.floor(Number(betAmount) * (multiplier - 1)));

  return { segmentIndex, multiplier, profit };
}
