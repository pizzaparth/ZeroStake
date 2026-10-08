import { bytesToHex } from "@noble/hashes/utils.js";

import { hashServerSeed } from "./provablyFair";
import type { SeedCommitment, SeedInput } from "./types";

export type RandomBytesFn = (length: number) => Uint8Array;

/** 32 random bytes as 64 hex chars. */
export function generateServerSeed(randomBytes: RandomBytesFn): string {
  return bytesToHex(randomBytes(32));
}

/** 8 random bytes as 16 hex chars. Players can replace it with any text. */
export function generateClientSeed(randomBytes: RandomBytesFn): string {
  return bytesToHex(randomBytes(8));
}

export const CLIENT_SEED_MAX_LENGTH = 64;

/** Client seeds are free text, but must be non-empty and contain no ':' (the HMAC message separator). */
export function validateClientSeed(seed: string): string | null {
  const trimmed = seed.trim();
  if (trimmed.length === 0) return "Client seed cannot be empty.";
  if (trimmed.length > CLIENT_SEED_MAX_LENGTH) return `Client seed must be ${CLIENT_SEED_MAX_LENGTH} characters or fewer.`;
  if (trimmed.includes(":")) return "Client seed cannot contain ':'.";
  return null;
}

export interface SeedPairState {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  /** Nonce the NEXT bet will use. */
  nonce: number;
}

export function createSeedPair(randomBytes: RandomBytesFn, clientSeed?: string): SeedPairState {
  const serverSeed = generateServerSeed(randomBytes);
  return {
    serverSeed,
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed: clientSeed ?? generateClientSeed(randomBytes),
    nonce: 0,
  };
}

/** What the player may see about the active pair: never the raw server seed. */
export function toCommitment(pair: SeedPairState): SeedCommitment {
  return { serverSeedHash: pair.serverSeedHash, clientSeed: pair.clientSeed, nonce: pair.nonce };
}

/**
 * Takes the next nonce for a bet. Returns the seeds for that bet and the pair
 * advanced by one, so (serverSeed, clientSeed, nonce) is never reused.
 */
export function consumeNonce(pair: SeedPairState): { seeds: SeedInput; next: SeedPairState } {
  return {
    seeds: { serverSeed: pair.serverSeed, clientSeed: pair.clientSeed, nonce: pair.nonce },
    next: { ...pair, nonce: pair.nonce + 1 },
  };
}

export interface RotationResult {
  /** The retired pair; its server seed is now safe to show. */
  revealed: SeedPairState;
  /** Fresh pair: new server seed (hash shown only), nonce reset to 0. */
  next: SeedPairState;
}

export function rotateSeedPair(current: SeedPairState, randomBytes: RandomBytesFn, newClientSeed?: string): RotationResult {
  return {
    revealed: current,
    next: createSeedPair(randomBytes, newClientSeed ?? current.clientSeed),
  };
}
