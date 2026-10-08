import { Prisma, GameType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { settleBet, reserveBet, type SettleParams } from "@/lib/game-balance";

/**
 * Server-side storage for a stateful game's secret in-progress data (mine
 * positions, dragon positions, dealt cards, deck order). Authenticated play
 * uses this instead of the client-visible base64 blob used by guest play —
 * the blob is unsigned and ships secrets in the clear (e.g. Mines'
 * minePositions are readable via base64-decode before a tile is revealed).
 * Guest play keeps the blob mechanism: no DB row to key against without an
 * account, and no real balance is at stake there.
 */

/**
 * Prisma's InputJsonValue requires plain index-signature-compatible objects —
 * nominal interfaces like Card or BlackjackHand don't structurally qualify
 * even though they're plain data at runtime. A JSON round-trip erases the
 * nominal type safely for these DTOs (no Dates/Maps/methods involved).
 */
export function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

export async function createRound(
  userId: string,
  game: GameType,
  betAmount: bigint,
  payload: unknown,
  tx: Prisma.TransactionClient = prisma
): Promise<string> {
  const round = await tx.gameRound.create({
    data: { userId, game, betAmount, payload: toJsonValue(payload) },
    select: { id: true },
  });
  return round.id;
}

/**
 * Atomically claims a round for exclusive processing: the request that wins
 * the race to flip claimedAt from null to now proceeds; a concurrent request
 * for the same token gets null back and must not act on the round. Without
 * this, two concurrent requests carrying the same token could both read the
 * round before either mutates it — e.g. both settle a cashout, double-paying
 * the same bet. Pair every claim with releaseRound (round continues) or
 * resolveRound (round is terminal).
 */
export async function claimRound<T>(
  token: string,
  userId: string
): Promise<{ betAmount: bigint; payload: T; createdAt: Date } | null> {
  return prisma.$transaction(async (tx) => {
    const round = await tx.gameRound.findUnique({ where: { id: token } });
    if (!round || round.userId !== userId) return null;

    const claim = await tx.gameRound.updateMany({
      where: { id: token, claimedAt: null },
      data: { claimedAt: new Date() },
    });
    if (claim.count === 0) return null;

    return { betAmount: round.betAmount, payload: round.payload as T, createdAt: round.createdAt };
  });
}

/** Saves a claimed round's evolved payload and releases the claim so the next request can act on it. */
export async function releaseRound(
  token: string,
  payload: unknown,
  tx: Prisma.TransactionClient = prisma
): Promise<void> {
  await tx.gameRound.update({
    where: { id: token },
    data: { payload: toJsonValue(payload), claimedAt: null },
  });
}

/**
 * Clears a round's claim without touching its payload, only if it's still
 * claimed. For failure paths: if the failed-looking operation actually
 * committed (lost acknowledgement), the round is already unclaimed or gone, so
 * this is a no-op instead of writing stale state back over it.
 */
export async function unclaimRound(token: string): Promise<void> {
  await prisma.gameRound
    .updateMany({ where: { id: token, claimedAt: { not: null } }, data: { claimedAt: null } })
    .catch(() => {
      // Best effort: callers are already handling a more important error.
    });
}

/** The round was already settled or forfeited (e.g. by a seed rotation) before this request could settle it. */
export class RoundGoneError extends Error {
  constructor() {
    super("This round has already ended.");
    this.name = "RoundGoneError";
  }
}

/**
 * Terminal settlement for a claimed round: deletes the round and settles the
 * bet in ONE transaction. The delete is guarded on the round still being
 * claimed (only the claim holder reaches here, and seed rotation only forfeits
 * unclaimed rounds), so the bet can't be settled twice, and a crash between the
 * two steps can't leave a settled round behind, still claimed, blocking rotation.
 *
 * If the settlement fails for any other reason (e.g. a transient DB error), the
 * transaction rolls back but the claim, committed earlier by claimRound, would
 * stay set forever, blocking both play and seed rotation. So the claim is
 * released before rethrowing, leaving the round playable (and retryable).
 *
 * `extraReserve` debits an additional stake placed by the final action itself
 * (a Blackjack double or split that ends the hand) in the same transaction, so
 * a failed settlement can't leave that stake debited while the round reverts
 * to its pre-action state (where a retry would debit it again).
 */
export async function settleRound(token: string, params: SettleParams, extraReserve = 0n): Promise<bigint> {
  try {
    return await prisma.$transaction(async (tx) => {
      const gone = await tx.gameRound.deleteMany({ where: { id: token, claimedAt: { not: null } } });
      if (gone.count !== 1) throw new RoundGoneError();
      if (extraReserve > 0n) await reserveBet(params.userId, extraReserve, tx);
      return settleBet(params, tx);
    });
  } catch (err) {
    if (!(err instanceof RoundGoneError)) await unclaimRound(token);
    throw err;
  }
}

export async function resolveRound(token: string): Promise<void> {
  await prisma.gameRound.delete({ where: { id: token } }).catch(() => {
    // Already resolved/deleted — terminal routes are idempotent by design.
  });
}
