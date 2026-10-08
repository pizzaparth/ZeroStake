import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  generateMinePositions,
} from "@/lib/game-engine";
import { auth } from "@/auth";
import { reserveBet } from "@/lib/game-balance";
import { withSeeds, pairFields, playErrorResponse } from "@/lib/seeded-play";
import { createRound } from "@/lib/game-engine/round-store";

const schema = z.object({
  betAmount: z.number().int().min(100).max(10_000_00),
  mineCount: z.number().int().min(1).max(24),
  clientSeed: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { betAmount, mineCount, clientSeed: suppliedClient } = parsed.data;

  // Account holders: the round resolves against the active seed pair. Nonce,
  // bet reservation and round creation share one transaction, so a seed
  // rotation always sees (and forfeits) the round. Mine positions stay
  // server-side; the server seed stays secret until the player rotates.
  const session = await auth();
  if (session?.user?.id) {
    const userId = session.user.id;
    try {
      const { token, seeds, balance } = await withSeeds(userId, 1, async (tx, seeds) => {
        const minePositions = generateMinePositions(seeds.serverSeed, seeds.clientSeed, seeds.firstNonce, mineCount);
        const balance = await reserveBet(userId, BigInt(betAmount), tx);
        const token = await createRound(
          userId, "mines", BigInt(betAmount),
          { ...pairFields(seeds), mineCount, minePositions, betAmount, revealedTiles: [] },
          tx
        );
        return { token, seeds, balance };
      });
      return NextResponse.json({
        token, serverSeedHash: seeds.serverSeedHash, clientSeed: seeds.clientSeed, nonce: seeds.firstNonce,
        mineCount, gridSize: 25, balance: Number(balance),
      });
    } catch (err) {
      const res = playErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }

  // Guest: a throwaway per-round seed in an opaque client-visible blob
  // (documented limitation, see round-store.ts). Not provably fair.
  const serverSeed = generateServerSeed();
  const clientSeed = suppliedClient ?? generateClientSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const minePositions = generateMinePositions(serverSeed, clientSeed, 0, mineCount);
  const state = Buffer.from(
    JSON.stringify({ serverSeed, clientSeed, mineCount, minePositions, betAmount })
  ).toString("base64");

  return NextResponse.json({ state, serverSeedHash, clientSeed, mineCount, gridSize: 25 });
}
