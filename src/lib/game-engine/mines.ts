import { generateOutcome } from "./rng";

const GRID_SIZE = 25; // 5×5

export interface MinesState {
  mineCount: number;
  minePositions: number[]; // indices 0–24, revealed only at game end
  revealed: number[];      // safe tile indices revealed so far
  active: boolean;
}

/**
 * Derives mine positions from the RNG outcome using a Fisher-Yates shuffle
 * seeded by successive HMAC outputs (one nonce, cursor increments per position).
 */
export function generateMinePositions(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  mineCount: number
): number[] {
  const positions = Array.from({ length: GRID_SIZE }, (_, i) => i);

  for (let i = GRID_SIZE - 1; i > 0; i--) {
    const outcome = generateOutcome(serverSeed, clientSeed, nonce, GRID_SIZE - 1 - i);
    const j = Math.floor(outcome * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  return positions.slice(0, mineCount);
}

/**
 * Multiplier for revealing `safeRevealed` tiles with `mineCount` mines.
 * Uses the standard combinatorial formula with 1% house edge:
 *   multiplier = (0.99) * C(25, safeRevealed) / C(25 - mineCount, safeRevealed)
 */
export function getMinesMultiplier(
  mineCount: number,
  safeRevealed: number
): number {
  if (safeRevealed === 0) return 1;

  const safeTiles = GRID_SIZE - mineCount;
  let numerator = 1;
  let denominator = 1;

  for (let i = 0; i < safeRevealed; i++) {
    numerator *= GRID_SIZE - i;
    denominator *= safeTiles - i;
  }

  const raw = (numerator / denominator) * 0.99;
  return Math.floor(raw * 100) / 100;
}

export function isMine(tileIndex: number, minePositions: number[]): boolean {
  return minePositions.includes(tileIndex);
}
