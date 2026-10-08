import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  resolveDiamonds,
} from "@/lib/game-engine";
import { auth } from "@/auth";
import { settleBet } from "@/lib/game-balance";
import { withSeeds, pairFields, playErrorResponse } from "@/lib/seeded-play";

const schema = z.object({
  betAmount: z.number().int().min(100).max(10_000_00),
  picks: z.array(z.number().int().min(0).max(11)).length(4),
  clientSeed: z.string().optional(),
  nonce: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { betAmount, picks, clientSeed: suppliedClient, nonce = 0 } = parsed.data;
  const resolve = (serverSeed: string, clientSeed: string, nonce: number) =>
    resolveDiamonds(serverSeed, clientSeed, nonce, BigInt(betAmount), picks);
  const view = (result: ReturnType<typeof resolve>) => ({
    picks: result.picks,
    tiles: result.tiles,
    diamondPositions: result.diamondPositions,
    hits: result.hits,
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
            game: "diamonds",
            betAmount: BigInt(betAmount),
            profit: result.profit,
            multiplier: result.multiplier,
            ...pairFields(seeds),
            outcome: { picks: result.picks, tiles: result.tiles, diamondPositions: result.diamondPositions, hits: result.hits },
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
