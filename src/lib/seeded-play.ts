import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { allocateNonces, NoActiveSeedPairError, type AllocatedSeeds } from "@/lib/seed-pair";
import { InsufficientBalanceError, type Tx } from "@/lib/game-balance";
import { RoundGoneError } from "@/lib/game-engine/round-store";

/**
 * Shared plumbing for account-holder bets on the per-player seed pair (see
 * src/lib/seed-pair.ts). Guest play keeps per-bet throwaway seeds and doesn't
 * use any of this.
 */

/**
 * Runs `fn` in one transaction with `count` nonces allocated from the user's
 * active pair. Settling (or creating the round) inside `fn` keeps the bet and
 * its nonce atomic with respect to seed rotation.
 */
export function withSeeds<T>(userId: string, count: number, fn: (tx: Tx, seeds: AllocatedSeeds) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => fn(tx, await allocateNonces(tx, userId, count)));
}

/** The seed fields settleBet records for the bet at `firstNonce + offset`. */
export function pairFields(seeds: AllocatedSeeds, offset = 0) {
  return {
    serverSeed: seeds.serverSeed,
    serverSeedHash: seeds.serverSeedHash,
    clientSeed: seeds.clientSeed,
    nonce: seeds.firstNonce + offset,
    seedPairId: seeds.seedPairId,
  };
}

/** Seed material a stateful round carries in its server-side payload. */
export interface SeededPayload {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  /** Absent on rounds started before seed pairs, which used per-round seeds. */
  seedPairId?: string;
}

/** settleBet's seed fields, taken from a round's payload. */
export function payloadSeedFields(p: SeededPayload) {
  return {
    serverSeed: p.serverSeed,
    serverSeedHash: p.serverSeedHash,
    clientSeed: p.clientSeed,
    nonce: p.nonce,
    seedPairId: p.seedPairId,
  };
}

/**
 * A pair's server seed stays secret until the player rotates, since it covers
 * their future bets too, so responses must not carry it. Rounds started before
 * seed pairs used a per-round seed and still reveal it at the end, as before.
 */
export function hideSeed<T extends object>(payload: { seedPairId?: string }, result: T): T {
  if (!payload.seedPairId || !("serverSeed" in result)) return result;
  const rest: Record<string, unknown> = { ...result };
  delete rest.serverSeed;
  return rest as T;
}

/** Maps the expected account-holder errors to responses; null for anything else. */
export function playErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof NoActiveSeedPairError) {
    return NextResponse.json({ error: err.message, code: "no_active_seed_pair" }, { status: 409 });
  }
  if (err instanceof InsufficientBalanceError) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }
  if (err instanceof RoundGoneError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  return null;
}
