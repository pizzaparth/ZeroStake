import { generateFloat, hashServerSeed, hmacHex, hmacMessage } from "./provablyFair";
import type { SeedInput } from "./types";

/** True if the revealed server seed hashes to the commitment shown before play. */
export function verifyCommitment(serverSeed: string, serverSeedHash: string): boolean {
  return hashServerSeed(serverSeed) === serverSeedHash.toLowerCase();
}

export interface RngTraceRow {
  cursor: number;
  message: string;
  hmac: string;
  /** First 4 bytes of the HMAC as hex: the bytes the float is built from. */
  bytes: string;
  float: number;
}

/** Step-by-step RNG derivation for the fairness screen. */
export function traceRng(seeds: SeedInput, cursorCount: number): RngTraceRow[] {
  return Array.from({ length: cursorCount }, (_, cursor) => {
    const hmac = hmacHex(seeds.serverSeed, seeds.clientSeed, seeds.nonce, cursor);
    return {
      cursor,
      message: hmacMessage(seeds.clientSeed, seeds.nonce, cursor),
      hmac,
      bytes: hmac.slice(0, 8),
      float: generateFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce, cursor),
    };
  });
}
