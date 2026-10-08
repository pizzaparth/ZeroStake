import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  resolvePlinko,
  type PlinkoRisk,
} from "@/lib/game-engine";
import { auth } from "@/auth";
import { InsufficientBalanceError } from "@/lib/game-balance";
import { withSeeds, pairFields, playErrorResponse } from "@/lib/seeded-play";

const schema = z.object({
  betAmount: z.number().int().min(100).max(10_000_00),
  rows: z.union([z.literal(8), z.literal(12), z.literal(16)]),
  risk: z.enum(["low", "medium", "high"]),
  count: z.number().int().min(1).max(100).default(1),
  clientSeed: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { betAmount, rows, risk, count, clientSeed: suppliedClient } = parsed.data;
  const drop = (serverSeed: string, clientSeed: string, nonce: number) =>
    resolvePlinko(serverSeed, clientSeed, nonce, BigInt(betAmount), rows, risk as PlinkoRisk);
  const view = (r: ReturnType<typeof drop>) => ({
    path: r.path,
    bucketIndex: r.bucketIndex,
    multiplier: r.multiplier,
    profit: Number(r.profit),
  });

  // Account holders: every ball is its own bet with its own nonce from the
  // active seed pair, all allocated and settled in one transaction. The server
  // seed stays secret until they rotate.
  const session = await auth();
  if (session?.user?.id) {
    const userId = session.user.id;
    try {
      const { results, balance } = await withSeeds(userId, count, async (tx, seeds) => {
        const balls = Array.from({ length: count }, (_, i) => ({
          seed: pairFields(seeds, i),
          result: drop(seeds.serverSeed, seeds.clientSeed, seeds.firstNonce + i),
        }));
        const totalBet = BigInt(betAmount) * BigInt(count);
        const totalProfit = balls.reduce((sum, b) => sum + b.result.profit, 0n);

        const guard = await tx.user.updateMany({
          where: { id: userId, balance: { gte: totalBet } },
          data: { balance: { increment: totalProfit } },
        });
        if (guard.count === 0) throw new InsufficientBalanceError();

        await tx.gameSession.createMany({
          data: balls.map((b) => ({
            userId,
            game: "plinko" as const,
            betAmount: BigInt(betAmount),
            profit: b.result.profit,
            multiplier: b.result.multiplier,
            ...b.seed,
            outcome: { bucketIndex: b.result.bucketIndex, rows, risk },
          })),
        });

        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } });
        return {
          results: balls.map((b) => ({
            ...view(b.result),
            serverSeedHash: b.seed.serverSeedHash,
            clientSeed: b.seed.clientSeed,
            nonce: b.seed.nonce,
          })),
          balance: user.balance,
        };
      });
      return NextResponse.json({ results, balance: Number(balance) });
    } catch (err) {
      const res = playErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }

  // Guest: a throwaway seed per ball, revealed immediately. Recomputable, but not
  // provably fair (nothing was committed before the bet).
  const results = Array.from({ length: count }, (_, i) => {
    const serverSeed = generateServerSeed();
    const clientSeed = suppliedClient ?? generateClientSeed();
    return { ...view(drop(serverSeed, clientSeed, i)), serverSeed, serverSeedHash: hashServerSeed(serverSeed), clientSeed, nonce: i };
  });
  return NextResponse.json({ results });
}
