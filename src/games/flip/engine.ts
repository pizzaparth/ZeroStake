import { GAME_RTP } from "@/config/rtp";
import { createFloatStream } from "@/engine/rng/byteGenerator";
import { floorTo } from "@/engine/probability/houseEdge";
import type { InstantGame } from "../types";

/**
 * Flip — pick a side and a streak length N (1–10). N coins are flipped
 * (cursor i for flip i); you win only if all N land on your side.
 *
 *   P(win) = 0.5^N
 *   multiplier = floor₄(RTP × 2^N)
 *
 * The original paid 1.98^N (edge compounded per flip, RTP 0.99^N); the edge is
 * now applied once so every streak length returns the configured RTP.
 */

export type CoinSide = "heads" | "tails";
export const FLIP_RTP = GAME_RTP.flip;
export const FLIP_MAX_STREAK = 10;

export function flipMultiplier(streak: number, rtp = FLIP_RTP): number {
  return floorTo(rtp * 2 ** streak, 4);
}

export interface FlipParams {
  side: CoinSide;
  streak: number;
}

export interface FlipOutcome {
  flips: CoinSide[];
  side: CoinSide;
  streak: number;
  win: boolean;
}

export const flipGame: InstantGame<FlipParams, FlipOutcome> = {
  kind: "instant",
  play(seeds, { side, streak }) {
    if (!Number.isInteger(streak) || streak < 1 || streak > FLIP_MAX_STREAK) throw new Error("Invalid streak");
    const stream = createFloatStream(seeds);
    const flips: CoinSide[] = Array.from({ length: streak }, () => (stream.next() < 0.5 ? "heads" : "tails"));
    const win = flips.every((f) => f === side);
    return { multiplier: win ? flipMultiplier(streak) : 0, stakeUnits: 1, outcome: { flips, side, streak, win } };
  },
};
