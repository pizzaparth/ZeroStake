import { generateOutcome } from "./rng";

const HOUSE_EDGE = 0.01; // 1%

export interface DiceResult {
  roll: number;       // 0.00–99.99
  target: number;     // 2–98
  direction: "over" | "under";
  win: boolean;
  multiplier: number;
  profit: bigint;     // chips (positive = win, negative = loss)
}

/**
 * Returns the payout multiplier for a given target and direction.
 * Formula: (100 - houseEdge) / winProbability
 */
export function getDiceMultiplier(
  target: number,
  direction: "over" | "under"
): number {
  const winProbability =
    direction === "over" ? (99 - target) / 100 : target / 100;
  return parseFloat(((1 - HOUSE_EDGE) / winProbability).toFixed(4));
}

export function resolveDice(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  betAmount: bigint,
  target: number,
  direction: "over" | "under"
): DiceResult {
  const outcome = generateOutcome(serverSeed, clientSeed, nonce);
  const roll = parseFloat((outcome * 100).toFixed(2));

  const win =
    direction === "over" ? roll > target : roll < target;

  const multiplier = getDiceMultiplier(target, direction);
  const profit = win
    ? BigInt(Math.floor(Number(betAmount) * (multiplier - 1)))
    : -betAmount;

  return { roll, target, direction, win, multiplier, profit };
}
