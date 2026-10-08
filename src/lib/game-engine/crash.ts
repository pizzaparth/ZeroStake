import { generateOutcome } from "./rng";

const HOUSE_EDGE = 0.01; // 1%

/**
 * Derives the crash point from a provably fair outcome.
 *
 * Formula (the standard crash-game formula):
 *   e = outcome (float in [0, 1))
 *   crashPoint = max(1.00, (1 - houseEdge) / (1 - e))
 *
 * The house edge means ~1% of rounds crash at exactly 1.00× ("instant crash").
 * When e < houseEdge, return 1.00 to model that.
 */
export function getCrashPoint(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): number {
  const e = generateOutcome(serverSeed, clientSeed, nonce);

  if (e < HOUSE_EDGE) return 1.0;

  const raw = (1 - HOUSE_EDGE) / (1 - e);
  return Math.floor(raw * 100) / 100; // floor to 2 decimal places
}

/**
 * Multiplier reachable after `elapsedMs` of real time — mirrors the client's
 * own animation formula (src/app/games/crash/page.tsx's calcMultiplier)
 * exactly, so the server can validate a claimed cashout against real elapsed
 * time instead of trusting it outright.
 *
 * This closes the "instant claim" exploit (submitting an unreachable
 * cashedOutAt the moment the round starts) for authenticated play, where
 * elapsed time is measured from the round's DB row creation. It does not
 * close the deeper structural gap that the client needs `crashPoint` up
 * front to animate at all (no server-push round loop exists) — a scripted
 * client can still wait the correct real time and cash out at exactly the
 * crash point on every round. Fully closing that requires the real-time
 * multiplayer Crash round this project has deferred; see docs/roadmap.md.
 */
export function crashMultiplierAtElapsed(elapsedMs: number): number {
  return Math.floor(Math.pow(Math.E, 0.00006 * elapsedMs) * 100) / 100;
}

export interface CrashBetResult {
  cashedOutAt: number | null; // null = busted
  profit: bigint;
}

export function resolveCrashBet(
  betAmount: bigint,
  cashedOutAt: number | null,
  crashPoint: number
): CrashBetResult {
  if (cashedOutAt === null || cashedOutAt > crashPoint) {
    return { cashedOutAt: null, profit: -betAmount };
  }
  const profit = BigInt(Math.floor(Number(betAmount) * (cashedOutAt - 1)));
  return { cashedOutAt, profit };
}
