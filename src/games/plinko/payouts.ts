import { GAME_RTP } from "@/config/rtp";
import { binomial } from "@/engine/probability/combinatorics";
import { scalePayoutTable } from "@/engine/probability/distributions";

/**
 * Plinko buckets: the ball makes `rows` independent 50/50 bounces, so it lands
 * in bucket k (number of rights) with P(k) = C(rows, k) / 2^rows.
 *
 * Shapes come from the original tables. Two were broken there: high/16 was
 * missing an entry (RTP 201%) and high/12 returned 78%. Every table is now
 * scaled so Σ P(k)·payout(k) = RTP.
 */

export type PlinkoRisk = "low" | "medium" | "high";
export type PlinkoRows = 8 | 12 | 16;
export const PLINKO_ROW_OPTIONS: PlinkoRows[] = [8, 12, 16];
export const PLINKO_RTP = GAME_RTP.plinko;

const SHAPES: Record<PlinkoRisk, Record<PlinkoRows, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [141, 20, 5.5, 1.5, 0.5, 0.3, 0.1, 0.3, 0.5, 1.5, 5.5, 20, 141],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export function plinkoBucketProbabilities(rows: PlinkoRows): number[] {
  return Array.from({ length: rows + 1 }, (_, k) => binomial(rows, k));
}

export const PLINKO_TABLES: Record<PlinkoRisk, Record<PlinkoRows, number[]>> = Object.fromEntries(
  (Object.keys(SHAPES) as PlinkoRisk[]).map((risk) => [
    risk,
    Object.fromEntries(PLINKO_ROW_OPTIONS.map((rows) => [rows, scalePayoutTable(plinkoBucketProbabilities(rows), SHAPES[risk][rows], PLINKO_RTP)])),
  ]),
) as Record<PlinkoRisk, Record<PlinkoRows, number[]>>;

export function plinkoTable(rows: PlinkoRows, risk: PlinkoRisk): number[] {
  return PLINKO_TABLES[risk][rows];
}
