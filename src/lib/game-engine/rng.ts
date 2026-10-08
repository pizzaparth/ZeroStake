import { createHash, createHmac, randomBytes } from "crypto";

/**
 * Provably fair RNG using HMAC-SHA256.
 *
 * Protocol:
 *   1. Server generates serverSeed and publishes SHA256(serverSeed) before the round.
 *   2. Player supplies a clientSeed (or we generate one).
 *   3. Each bet uses its own nonce, so one seed pair can serve many bets.
 *   4. Outcome = HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`) → float in [0, 1).
 *      A bet that needs several floats (a deck shuffle, mine layout, plinko rows)
 *      draws them at cursor 0, 1, 2… under the SAME nonce. Offsetting the nonce
 *      instead would make bet n+1 reuse most of bet n's floats under a
 *      persistent seed, so seeing one hand would leak the next.
 *   5. After the round, server reveals serverSeed so the player can verify.
 */

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function generateClientSeed(): string {
  return randomBytes(8).toString("hex");
}

export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

/** The seed material one bet (or one stateful round) resolves against. */
export interface SeedInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

/** A throwaway single-use seed set: fresh server seed, nonce 0. */
export function freshSeeds(clientSeed?: string): SeedInput {
  return { serverSeed: generateServerSeed(), clientSeed: clientSeed ?? generateClientSeed(), nonce: 0 };
}

/**
 * Derives a float in [0, 1) from the seed inputs.
 * Uses the first 8 hex chars (32 bits) of the HMAC output for precision.
 */
export function generateOutcome(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor = 0
): number {
  const hmac = createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}:${cursor}`)
    .digest("hex");

  // Use first 8 hex chars → 32-bit unsigned int → divide by 2^32
  const intValue = parseInt(hmac.slice(0, 8), 16);
  return intValue / 0x100000000;
}

export function verifyBet(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  expectedOutcome: number,
  cursor = 0
): boolean {
  const actual = generateOutcome(serverSeed, clientSeed, nonce, cursor);
  return Math.abs(actual - expectedOutcome) < Number.EPSILON;
}
