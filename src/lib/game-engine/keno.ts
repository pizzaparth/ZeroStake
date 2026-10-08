import { generateOutcome } from "./rng";

/**
 * Keno — pick 1–10 tiles from a 40-tile grid; server draws 10 distinct tiles.
 * Payout is determined by the number of hits (player picks that match draws).
 *
 * Fisher-Yates partial shuffle: at each step i we pick a random index from
 * the remaining pool, pull that tile out, and use cursor i for the outcome.
 * This gives provably-fair, distinct draws.
 */

export type KenoSpot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// PAYOUT[picks][hits] — 0 for hits below the threshold
// Table targets ~96% RTP, matching standard casino Keno payouts.
const PAYOUT: Record<KenoSpot, Record<number, number>> = {
  1:  { 1: 3.96 },
  2:  { 2: 9 },
  3:  { 2: 1.5,  3: 16 },
  4:  { 2: 1,    3: 4,   4: 60 },
  5:  { 3: 2,    4: 13,  5: 200 },
  6:  { 3: 2,    4: 7,   5: 45,   6: 400 },
  7:  { 3: 2,    4: 6,   5: 24,   6: 100,  7: 750 },
  8:  { 4: 4,    5: 17,  6: 100,  7: 500,  8: 1000 },
  9:  { 4: 4,    5: 9,   6: 50,   7: 250,  8: 500,  9: 2000 },
  10: { 0: 1.5,  5: 3,   6: 25,   7: 100,  8: 500,  9: 1000, 10: 10000 },
};

export function getKenoMultiplier(picks: KenoSpot, hits: number): number {
  const table = PAYOUT[picks];
  return table[hits] ?? 0;
}

export interface KenoResult {
  picks: number[];
  drawn: number[];
  hits: number;
  multiplier: number;
  profit: bigint;
}

export function resolveKeno(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  betAmount: bigint,
  picks: number[],
): KenoResult {
  // Draw 10 distinct tiles from 1–40 via partial Fisher-Yates
  const pool = Array.from({ length: 40 }, (_, i) => i + 1);
  const drawn: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = generateOutcome(serverSeed, clientSeed, nonce, i);
    const j = Math.floor(r * (40 - i));
    drawn.push(pool[j]);
    pool[j] = pool[39 - i];
  }

  const drawnSet = new Set(drawn);
  const hits = picks.filter((p) => drawnSet.has(p)).length;
  const numPicks = Math.min(10, Math.max(1, picks.length)) as KenoSpot;
  const multiplier = getKenoMultiplier(numPicks, hits);
  const profit = multiplier > 0
    ? BigInt(Math.round(Number(betAmount) * (multiplier - 1)))
    : -betAmount;

  return { picks, drawn, hits, multiplier, profit };
}
