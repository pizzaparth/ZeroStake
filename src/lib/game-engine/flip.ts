import { generateOutcome } from "./rng";

/**
 * Flip — pick a side, then a target streak length (1–10). The engine flips that
 * many coins; you win only if every flip lands on your side. Payout compounds at
 * 1.98× per flip (1% edge per flip), so:
 *   P(win) = 0.5^N,  payout = 1.98^N,  house edge = 1 − 0.99^N.
 *
 * Each flip consumes a fresh outcome at cursor = flip index.
 */

export type Side = "heads" | "tails";
const FLIP_PAYOUT = 1.98; // 2× minus 1% edge

export interface FlipResult {
  flips: Side[];        // resolved flips, in order
  side: Side;           // chosen side
  streak: number;       // leading matches before first miss
  targetStreak: number;
  win: boolean;
  multiplier: number;
  profit: bigint;
}

export function getFlipMultiplier(targetStreak: number): number {
  return parseFloat(Math.pow(FLIP_PAYOUT, targetStreak).toFixed(4));
}

export function resolveFlip(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  betAmount: bigint,
  side: Side,
  targetStreak: number
): FlipResult {
  const flips: Side[] = [];
  let streak = 0;
  let broken = false;

  for (let i = 0; i < targetStreak; i++) {
    const r = generateOutcome(serverSeed, clientSeed, nonce, i);
    const flip: Side = r < 0.5 ? "heads" : "tails";
    flips.push(flip);
    if (!broken && flip === side) streak++;
    else broken = true;
  }

  const win = streak >= targetStreak;
  const multiplier = getFlipMultiplier(targetStreak);
  const profit = win
    ? BigInt(Math.floor(Number(betAmount) * (multiplier - 1)))
    : -betAmount;

  return { flips, side, streak, targetStreak, win, multiplier, profit };
}
