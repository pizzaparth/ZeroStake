import { GAME_RTP } from "@/config/rtp";
import { hypergeometric } from "@/engine/probability/combinatorics";
import { scalePayoutTable } from "@/engine/probability/distributions";

/**
 * Keno pays by hits: 10 numbers are drawn from 40, the player picks 1–10.
 * P(hits = h | picks = n) is hypergeometric: C(10, h)·C(30, n−h) / C(40, n).
 *
 * The original tables returned only 36–87% for 2–10 picks (they were copied
 * from 80-ball/20-draw Keno). We keep their *shape* (which hit counts pay and
 * how steeply) and scale each table so Σ P(h)·payout(h) = RTP.
 */

export const KENO_TILES = 40;
export const KENO_DRAWS = 10;
export const KENO_MAX_PICKS = 10;
export const KENO_RTP = GAME_RTP.keno;

/** Relative payout shape per pick count, indexed by hits (from the original table). */
const SHAPES: Record<number, Record<number, number>> = {
  1: { 1: 3.96 },
  2: { 2: 9 },
  3: { 2: 1.5, 3: 16 },
  4: { 2: 1, 3: 4, 4: 60 },
  5: { 3: 2, 4: 13, 5: 200 },
  6: { 3: 2, 4: 7, 5: 45, 6: 400 },
  7: { 3: 2, 4: 6, 5: 24, 6: 100, 7: 750 },
  8: { 4: 4, 5: 17, 6: 100, 7: 500, 8: 1000 },
  9: { 4: 4, 5: 9, 6: 50, 7: 250, 8: 500, 9: 2000 },
  10: { 0: 1.5, 5: 3, 6: 25, 7: 100, 8: 500, 9: 1000, 10: 10000 },
};

export function kenoHitProbabilities(picks: number): number[] {
  return Array.from({ length: picks + 1 }, (_, h) => hypergeometric(KENO_TILES, KENO_DRAWS, picks, h));
}

function buildTable(picks: number): number[] {
  const shape = Array.from({ length: picks + 1 }, (_, h) => SHAPES[picks][h] ?? 0);
  return scalePayoutTable(kenoHitProbabilities(picks), shape, KENO_RTP);
}

/** KENO_TABLES[picks][hits] = total return multiplier. */
export const KENO_TABLES: Record<number, number[]> = Object.fromEntries(Array.from({ length: KENO_MAX_PICKS }, (_, i) => [i + 1, buildTable(i + 1)]));

export function kenoMultiplier(picks: number, hits: number): number {
  return KENO_TABLES[picks]?.[hits] ?? 0;
}
