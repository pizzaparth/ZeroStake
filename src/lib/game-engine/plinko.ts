import { generateOutcome } from "./rng";

export type PlinkoRisk = "low" | "medium" | "high";

/**
 * Multiplier tables per row count per risk level.
 * Values are symmetric — index from left or right.
 * Source: the standard industry Plinko payout tables.
 */
const MULTIPLIERS: Record<PlinkoRisk, Record<number, number[]>> = {
  low: {
    8:  [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8:  [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8:  [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [141, 20, 5.5, 1.5, 0.5, 0.3, 0.1, 0.3, 0.5, 1.5, 5.5, 20, 141],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export interface PlinkoResult {
  path: Array<"L" | "R">;  // one direction per row
  bucketIndex: number;      // 0 = leftmost
  multiplier: number;
  profit: bigint;
}

/**
 * Resolves a Plinko drop. Each row draws the next cursor under one nonce for its L/R decision.
 */
export function resolvePlinko(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  betAmount: bigint,
  rows: 8 | 12 | 16,
  risk: PlinkoRisk
): PlinkoResult {
  const path: Array<"L" | "R"> = [];
  let bucketIndex = 0;

  for (let row = 0; row < rows; row++) {
    const outcome = generateOutcome(serverSeed, clientSeed, nonce, row);
    const direction = outcome < 0.5 ? "L" : "R";
    path.push(direction);
    if (direction === "R") bucketIndex++;
  }

  const multiplierTable = MULTIPLIERS[risk][rows];
  const multiplier = multiplierTable[bucketIndex];
  const profit = BigInt(Math.floor(Number(betAmount) * (multiplier - 1)));

  return { path, bucketIndex, multiplier, profit };
}

export function getMultiplierTable(rows: 8 | 12 | 16, risk: PlinkoRisk): number[] {
  return MULTIPLIERS[risk][rows];
}
