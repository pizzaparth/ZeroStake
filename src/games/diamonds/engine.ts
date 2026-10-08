import { createFloatStream } from "@/engine/rng/byteGenerator";
import { hypergeometric } from "@/engine/probability/combinatorics";
import { sampleWithoutReplacement } from "@/engine/probability/distributions";
import type { InstantGame } from "../types";

/**
 * Diamonds — 3 diamonds hide among 12 tiles; the player picks 4 and is paid by
 * how many picks hold a diamond. Placement: partial Fisher–Yates, cursor i for
 * the i-th diamond (original layout).
 *
 * P(h) = C(3, h)·C(9, 4 − h) / C(12, 4)
 * Paytable is the original classic one; RTP is computed from it (≈ 96.7%).
 */

export const DIAMONDS_TILES = 12;
export const DIAMONDS_HIDDEN = 3;
export const DIAMONDS_PICKS = 4;
export const DIAMONDS_PAYTABLE = [0, 0.4, 2, 18];

export type GemType = "diamond" | "ruby" | "emerald" | "sapphire" | "topaz";
const FILLER: GemType[] = ["ruby", "emerald", "sapphire", "topaz"];

export function diamondsHitProbabilities(): number[] {
  return DIAMONDS_PAYTABLE.map((_, h) => hypergeometric(DIAMONDS_TILES, DIAMONDS_HIDDEN, DIAMONDS_PICKS, h));
}

export function diamondsRtp(): number {
  return diamondsHitProbabilities().reduce((sum, p, h) => sum + p * DIAMONDS_PAYTABLE[h], 0);
}

/** Decorative gems for non-diamond tiles (cosmetic only, cycled by position). */
export function diamondsBoard(diamonds: number[]): GemType[] {
  let filler = 0;
  return Array.from({ length: DIAMONDS_TILES }, (_, i) => (diamonds.includes(i) ? "diamond" : FILLER[filler++ % FILLER.length]));
}

export interface DiamondsParams {
  picks: number[];
}

export interface DiamondsOutcome {
  picks: number[];
  diamonds: number[];
  hits: number;
}

export const diamondsGame: InstantGame<DiamondsParams, DiamondsOutcome> = {
  kind: "instant",
  play(seeds, { picks }) {
    const valid =
      picks.length === DIAMONDS_PICKS &&
      new Set(picks).size === DIAMONDS_PICKS &&
      picks.every((p) => Number.isInteger(p) && p >= 0 && p < DIAMONDS_TILES);
    if (!valid) throw new Error("Pick exactly 4 tiles");
    const stream = createFloatStream(seeds);
    const diamonds = sampleWithoutReplacement(DIAMONDS_TILES, DIAMONDS_HIDDEN, stream.at);
    const hits = picks.filter((p) => diamonds.includes(p)).length;
    return { multiplier: DIAMONDS_PAYTABLE[hits], stakeUnits: 1, outcome: { picks, diamonds, hits } };
  },
};
