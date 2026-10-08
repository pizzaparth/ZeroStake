import { GAME_RTP } from "@/config/rtp";
import { createFloatStream } from "@/engine/rng/byteGenerator";
import { floorTo } from "@/engine/probability/houseEdge";
import type { InstantGame } from "../types";

/**
 * Limbo — pick a target multiplier; a result multiplier is generated and you
 * win `target` if result ≥ target.
 *
 * result = max(1, floor₂(RTP / (1 − u))),  u ∈ [0, 1)
 * For a 2-dp target t ≥ 1.01:  P(result ≥ t) = P(RTP/(1−u) ≥ t) = RTP / t,
 * so every target returns exactly RTP. (Ported unchanged from the original.)
 */

export const LIMBO_RTP = GAME_RTP.limbo;
export const LIMBO_MIN_TARGET = 1.01;
export const LIMBO_MAX_TARGET = 1_000_000;

export interface LimboParams {
  target: number;
}

export interface LimboOutcome {
  result: number;
  target: number;
  win: boolean;
}

export function limboWinChance(target: number, rtp = LIMBO_RTP): number {
  return rtp / target;
}

export function limboResult(u: number, rtp = LIMBO_RTP): number {
  return Math.min(LIMBO_MAX_TARGET, Math.max(1, floorTo(rtp / (1 - u), 2)));
}

export function isValidLimboTarget(target: number): boolean {
  return Number.isFinite(target) && target >= LIMBO_MIN_TARGET && target <= LIMBO_MAX_TARGET && floorTo(target, 2) === target;
}

export const limboGame: InstantGame<LimboParams, LimboOutcome> = {
  kind: "instant",
  play(seeds, { target }) {
    if (!isValidLimboTarget(target)) throw new Error("Invalid limbo target");
    const result = limboResult(createFloatStream(seeds).next());
    const win = result >= target;
    return { multiplier: win ? target : 0, stakeUnits: 1, outcome: { result, target, win } };
  },
};
