import { Prisma, GameType } from "@prisma/client";
import { prisma } from "@/lib/db";

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Insufficient balance");
    this.name = "InsufficientBalanceError";
  }
}

export type Tx = Prisma.TransactionClient;

/** Runs `fn` inside the caller's transaction if given, otherwise in a new one. */
function inTx<T>(tx: Tx | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return tx ? fn(tx) : prisma.$transaction(fn);
}

/**
 * Reserves a bet for a stateful game's `start` step: atomically checks and
 * decrements balance in one guarded UPDATE (no read-then-write race window —
 * safe under concurrent requests from the same user). No GameSession is
 * written here since the game hasn't resolved yet.
 */
export async function reserveBet(userId: string, betAmount: bigint, tx?: Tx): Promise<bigint> {
  return inTx(tx, async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: userId, balance: { gte: betAmount } },
      data: { balance: { decrement: betAmount } },
    });
    if (result.count === 0) throw new InsufficientBalanceError();

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } });
    return user.balance;
  });
}

export interface SettleParams {
  userId: string;
  game: GameType;
  betAmount: bigint;
  profit: bigint; // net, signed — matches the game-engine convention (positive = win, negative = loss)
  multiplier: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  outcome: Prisma.InputJsonValue;
  /** true when reserveBet() already debited this wager at `start` — the credit
   *  here is the payout only (betAmount + profit), not the full profit delta. */
  reserved: boolean;
  /** The seed pair this bet resolved against; omitted for guest-style throwaway seeds. */
  seedPairId?: string;
}

/**
 * Resolves a bet: applies the balance delta and records a GameSession row,
 * atomically. For unreserved (stateless) bets, also guards against
 * insufficient balance in the same atomic UPDATE as the debit+credit.
 */
export async function settleBet(params: SettleParams, tx?: Tx): Promise<bigint> {
  const { userId, betAmount, profit, reserved } = params;

  return inTx(tx, async (tx) => {
    let balance: bigint;

    if (reserved) {
      // Bet was already debited at start — credit back the payout only.
      const updated = await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: betAmount + profit } },
      });
      balance = updated.balance;
    } else {
      // Single-shot settle: profit already nets the wager against the payout,
      // so applying it directly is correct — but only if the wager was affordable.
      const result = await tx.user.updateMany({
        where: { id: userId, balance: { gte: betAmount } },
        data: { balance: { increment: profit } },
      });
      if (result.count === 0) throw new InsufficientBalanceError();
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } });
      balance = user.balance;
    }

    await tx.gameSession.create({
      data: {
        userId,
        game: params.game,
        betAmount,
        profit,
        multiplier: params.multiplier,
        serverSeed: params.serverSeed,
        serverSeedHash: params.serverSeedHash,
        clientSeed: params.clientSeed,
        nonce: params.nonce,
        outcome: params.outcome,
        seedPairId: params.seedPairId,
      },
    });

    return balance;
  });
}
