import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  resolveLimbo,
} from "@/lib/game-engine";
import { auth } from "@/auth";
import { settleBet } from "@/lib/game-balance";
import { withSeeds, pairFields, playErrorResponse } from "@/lib/seeded-play";

const schema = z.object({
  betAmount: z.number().int().min(100).max(10_000_00),
  target: z.number().min(1.01).max(1_000_000),
  clientSeed: z.string().optional(),
  nonce: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { betAmount, target, clientSeed: suppliedClient, nonce = 0 } = parsed.data;
  const resolve = (serverSeed: string, clientSeed: string, nonce: number) =>
    resolveLimbo(serverSeed, clientSeed, nonce, BigInt(betAmount), target);
  const view = (result: ReturnType<typeof resolve>) => ({
    result: result.result,
    target: result.target,
    win: result.win,
    multiplier: result.multiplier,
    profit: Number(result.profit),
  });

  // Account holders: resolve against the active seed pair. The server seed stays
  // secret until they rotate; the per-request clientSeed/nonce are ignored.
  const session = await auth();
  if (session?.user?.id) {
    const userId = session.user.id;
    try {
      const { result, seeds, balance } = await withSeeds(userId, 1, async (tx, seeds) => {
        const result = resolve(seeds.serverSeed, seeds.clientSeed, seeds.firstNonce);
        const balance = await settleBet(
          {
            userId,
            game: "limbo",
            betAmount: BigInt(betAmount),
            profit: result.profit,
            multiplier: result.multiplier,
            ...pairFields(seeds),
            outcome: { result: result.result, win: result.win, target },
            reserved: false,
          },
          tx
        );
        return { result, seeds, balance };
      });
      return NextResponse.json({
        ...view(result),
        serverSeedHash: seeds.serverSeedHash,
        clientSeed: seeds.clientSeed,
        nonce: seeds.firstNonce,
        balance: Number(balance),
      });
    } catch (err) {
      const res = playErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }

  // Guest: a throwaway per-bet seed, revealed immediately. Recomputable, but not
  // provably fair (nothing was committed before the bet).
  const serverSeed = generateServerSeed();
  const clientSeed = suppliedClient ?? generateClientSeed();
  const result = resolve(serverSeed, clientSeed, nonce);
  return NextResponse.json({ ...view(result), serverSeed, serverSeedHash: hashServerSeed(serverSeed), clientSeed, nonce });
}
