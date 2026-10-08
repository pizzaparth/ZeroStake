import { generateOutcome } from "./rng";

/**
 * Diamonds — a pick-4-from-12 reveal game.
 *
 * The server hides 3 diamonds among 12 tiles (a 3×4 grid). The player selects
 * 4 tiles before the round; payout is by how many of their picks contain a
 * diamond. The remaining 9 tiles are filled with decorative gems for the reveal.
 *
 * A Fisher-Yates shuffle of positions 0–11 (one HMAC outcome per cursor)
 * places the 3 diamonds at the first 3 shuffled positions.
 *
 * Payout table (targets ~96.5% RTP):
 *   0 hits: 0×
 *   1 hit:  0.4×
 *   2 hits: 2×
 *   3 hits: 18×
 *
 * Hypergeometric probabilities (3 diamonds in 12, pick 4):
 *   P(0) ≈ 25.45%  P(1) ≈ 50.91%  P(2) ≈ 21.82%  P(3) ≈ 1.82%
 *   RTP  = 0×0.2545 + 0.4×0.5091 + 2×0.2182 + 18×0.0182
 *        ≈ 0 + 0.2036 + 0.4364 + 0.3276 ≈ 0.967
 */

export type GemType = "diamond" | "ruby" | "emerald" | "sapphire" | "topaz";

// Decorative gems for non-diamond positions — cycled by position index
const FILLER_GEMS: GemType[] = ["ruby", "emerald", "sapphire", "topaz", "ruby", "emerald", "sapphire", "topaz", "ruby"];

const MULTIPLIERS: Record<number, number> = { 0: 0, 1: 0.4, 2: 2, 3: 18 };

export function getDiamondsMultiplier(hits: number): number {
  return MULTIPLIERS[hits] ?? 0;
}

export interface DiamondsResult {
  picks: number[];          // player's 4 tile indices (0–11)
  tiles: GemType[];         // all 12 revealed tile types
  diamondPositions: number[]; // where the 3 diamonds actually were
  hits: number;
  multiplier: number;
  profit: bigint;
}

export function resolveDiamonds(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  betAmount: bigint,
  picks: number[],          // exactly 4 indices in 0–11
): DiamondsResult {
  // Partial Fisher-Yates shuffle of 12 positions; first 3 get diamonds
  const positions = Array.from({ length: 12 }, (_, i) => i);
  const diamondPositions: number[] = [];
  for (let i = 0; i < 3; i++) {
    const r = generateOutcome(serverSeed, clientSeed, nonce, i);
    const j = Math.floor(r * (12 - i));
    diamondPositions.push(positions[j]);
    positions[j] = positions[11 - i];
  }

  const diamondSet = new Set(diamondPositions);

  // Build the full 12-tile reveal: diamonds where placed, filler gems elsewhere
  let fillerIdx = 0;
  const tiles: GemType[] = Array.from({ length: 12 }, (_, i) =>
    diamondSet.has(i) ? "diamond" : FILLER_GEMS[fillerIdx++ % FILLER_GEMS.length]
  );

  const hits = picks.filter((p) => diamondSet.has(p)).length;
  const multiplier = getDiamondsMultiplier(hits);
  const profit = multiplier > 0
    ? BigInt(Math.round(Number(betAmount) * (multiplier - 1)))
    : -betAmount;

  return { picks, tiles, diamondPositions, hits, multiplier, profit };
}
