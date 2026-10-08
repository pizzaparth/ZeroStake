import { generateFloat } from "./provablyFair";
import type { FloatStream, SeedInput } from "./types";

/**
 * Cursor-based float stream for one bet. Every game draws its randomness from
 * here, so a bet can consume as many floats as it needs while staying fully
 * reproducible from (serverSeed, clientSeed, nonce).
 *
 * Floats are memoised per cursor: replaying a multi-step round (Blackjack,
 * Hilo) re-reads the same cursors many times.
 */
export function createFloatStream(seeds: SeedInput, startCursor = 0): FloatStream {
  const cache = new Map<number, number>();
  let cursor = startCursor;

  const at = (c: number): number => {
    let value = cache.get(c);
    if (value === undefined) {
      value = generateFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce, c);
      cache.set(c, value);
    }
    return value;
  };

  return {
    at,
    next() {
      return at(cursor++);
    },
    get cursor() {
      return cursor;
    },
  };
}

/** Uniform integer in [0, n) from a float in [0, 1). */
export function floatToInt(float: number, n: number): number {
  return Math.min(n - 1, Math.floor(float * n));
}
