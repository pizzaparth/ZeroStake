import { GAME_RTP } from "@/config/rtp";
import { createFloatStream } from "@/engine/rng/byteGenerator";
import { floorTo } from "@/engine/probability/houseEdge";
import type { InstantGame } from "../types";

/**
 * Dice — roll 0.00–99.99 and bet it lands over or under a target.
 *
 * The roll is an integer r ∈ [0, 9999] (shown as r / 100), r = floor(float × 10000),
 * so every roll value has probability exactly 1/10000:
 *   under t:  win if r < 100t      P = 100t / 10000
 *   over  t:  win if r > 100t      P = (9999 − 100t) / 10000
 *   multiplier = RTP / P   (truncated to 4 dp)
 *
 * The original engine used P(over) = (99 − t)/100, which under-counted the
 * winning rolls by 0.99 percentage points; the formula above is exact.
 */

export type DiceDirection = "over" | "under";

export interface DiceParams {
  /** Target with 2 decimals, e.g. 50.5. */
  target: number;
  direction: DiceDirection;
}

export interface DiceOutcome {
  roll: number;
  target: number;
  direction: DiceDirection;
  win: boolean;
}

export const DICE_RTP = GAME_RTP.dice;
export const DICE_MIN_CHANCE = 0.01;
export const DICE_MAX_CHANCE = 0.98;
const SCALE = 10_000;

const toInt = (target: number) => Math.round(target * 100);

export function diceWinChance(target: number, direction: DiceDirection): number {
  const t = toInt(target);
  return direction === "under" ? t / SCALE : (SCALE - 1 - t) / SCALE;
}

export function diceMultiplier(target: number, direction: DiceDirection, rtp = DICE_RTP): number {
  const p = diceWinChance(target, direction);
  return p > 0 ? floorTo(rtp / p, 4) : 0;
}

/** Inverse of diceWinChance, snapped to the 0.01 grid. */
export function diceTargetForChance(chance: number, direction: DiceDirection): number {
  const c = Math.min(DICE_MAX_CHANCE, Math.max(DICE_MIN_CHANCE, chance));
  const t = direction === "under" ? Math.round(c * SCALE) : SCALE - 1 - Math.round(c * SCALE);
  return t / 100;
}

export function isValidDiceParams({ target, direction }: DiceParams): boolean {
  const p = diceWinChance(target, direction);
  return Number.isFinite(target) && p >= DICE_MIN_CHANCE - 1e-9 && p <= DICE_MAX_CHANCE + 1e-9;
}

export function rollDice(float: number): number {
  return Math.min(SCALE - 1, Math.floor(float * SCALE)) / 100;
}

export const diceGame: InstantGame<DiceParams, DiceOutcome> = {
  kind: "instant",
  play(seeds, params) {
    if (!isValidDiceParams(params)) throw new Error("Invalid dice target");
    const roll = rollDice(createFloatStream(seeds).next());
    const r = toInt(roll);
    const t = toInt(params.target);
    const win = params.direction === "under" ? r < t : r > t;
    return {
      multiplier: win ? diceMultiplier(params.target, params.direction) : 0,
      stakeUnits: 1,
      outcome: { roll, target: params.target, direction: params.direction, win },
    };
  },
};
