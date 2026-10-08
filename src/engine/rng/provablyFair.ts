import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * Verifiable RNG, ported from the original steak engine (src/lib/game-engine/rng.ts)
 * with Node's `crypto` swapped for @noble/hashes so it runs under Hermes.
 *
 * Protocol:
 *   1. A server seed is generated and only SHA256(serverSeed) is shown (commitment).
 *   2. The player owns a client seed.
 *   3. Each bet uses its own nonce, so one seed pair serves many bets.
 *   4. Float = first 4 bytes of HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`) / 2^32.
 *      A bet that needs several floats (deck shuffle, mine layout, plinko rows)
 *      reads cursor 0, 1, 2… under the SAME nonce.
 *   5. Rotating the seed pair reveals the server seed so every bet made on it
 *      can be recomputed.
 *
 * The HMAC key is the server seed's UTF-8 text (the hex string itself), which
 * matches the original Node implementation byte for byte.
 */

export function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

/** SHA256 commitment shown to the player before a server seed is revealed. */
export function hashServerSeed(serverSeed: string): string {
  return sha256Hex(serverSeed);
}

export function hmacMessage(clientSeed: string, nonce: number, cursor: number): string {
  return `${clientSeed}:${nonce}:${cursor}`;
}

/** Raw 32-byte HMAC digest for one cursor. */
export function hmacBytes(serverSeed: string, clientSeed: string, nonce: number, cursor = 0): Uint8Array {
  return hmac(sha256, utf8ToBytes(serverSeed), utf8ToBytes(hmacMessage(clientSeed, nonce, cursor)));
}

export function hmacHex(serverSeed: string, clientSeed: string, nonce: number, cursor = 0): string {
  return bytesToHex(hmacBytes(serverSeed, clientSeed, nonce, cursor));
}

/** First 4 bytes as a big-endian unsigned 32-bit integer, scaled into [0, 1). */
export function bytesToFloat(bytes: Uint8Array): number {
  const int = ((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
  return int / 0x100000000;
}

/** Deterministic float in [0, 1) for one (seed pair, nonce, cursor). */
export function generateFloat(serverSeed: string, clientSeed: string, nonce: number, cursor = 0): number {
  return bytesToFloat(hmacBytes(serverSeed, clientSeed, nonce, cursor));
}
