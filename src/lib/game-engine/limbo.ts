import { generateOutcome } from "./rng";

/**
 * Limbo — pick a target multiplier; a random result multiplier is generated.
 * You win if result ≥ target, paying out `target`.
 *
 * The result distribution satisfies P(result ≥ m) = (1 - edge) / m, which makes
 * a bet at any target carry exactly the house edge:
 *   result = (1 - edge) / (1 - r),  r ∈ [0, 1)
 */

const HOUSE_EDGE = 0.01;
const MAX_MULTIPLIER = 1_000_000;

export interface LimboResult {
  result: number;       // generated multiplier (2 dp)
  target: number;
  win: boolean;
  multiplier: number;   // = target on win, paid multiplier
  profit: bigint;
}

/** Win chance (%) for a given target multiplier. */
export function getLimboWinChance(target: number): number {
  return parseFloat((((1 - HOUSE_EDGE) / target) * 100).toFixed(4));
}

export function resolveLimbo(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  betAmount: bigint,
  target: number
): LimboResult {
  const r = generateOutcome(serverSeed, clientSeed, nonce);
  const raw = (1 - HOUSE_EDGE) / (1 - r);
  const result = Math.min(MAX_MULTIPLIER, Math.max(1, Math.floor(raw * 100) / 100));

  const win = result >= target;
  const profit = win
    ? BigInt(Math.floor(Number(betAmount) * (target - 1)))
    : -betAmount;

  return { result, target, win, multiplier: target, profit };
}
