import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dragonTowerStart, freshSeeds, type DragonTowerState } from "@/lib/game-engine";
import { auth } from "@/auth";
import { reserveBet } from "@/lib/game-balance";
import { withSeeds, playErrorResponse } from "@/lib/seeded-play";
import { createRound } from "@/lib/game-engine/round-store";

const schema = z.object({
  betAmount: z.number().int().min(100).max(10_000_00),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]),
  clientSeed: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { betAmount, difficulty, clientSeed } = parsed.data;

  // Account holders: the round resolves against the active seed pair. Nonce,
  // bet reservation and round creation share one transaction, so a seed
  // rotation always sees (and forfeits) the round. The server seed stays
  // secret until the player rotates.
  const session = await auth();
  if (session?.user?.id) {
    const userId = session.user.id;
    try {
      const { result, token, seeds, balance } = await withSeeds(userId, 1, async (tx, seeds) => {
        const result = dragonTowerStart(betAmount, difficulty, { serverSeed: seeds.serverSeed, clientSeed: seeds.clientSeed, nonce: seeds.firstNonce });
        const balance = await reserveBet(userId, BigInt(betAmount), tx);
        const payload: DragonTowerState = JSON.parse(Buffer.from(result.state, "base64").toString());
        const token = await createRound(
          userId, "dragon_tower", BigInt(betAmount),
          { ...payload, serverSeedHash: result.serverSeedHash, seedPairId: seeds.seedPairId },
          tx
        );
        return { result, token, seeds, balance };
      });
      return NextResponse.json({
        rows: result.rows, cols: result.cols, step: result.step, token,
        serverSeedHash: seeds.serverSeedHash, clientSeed: seeds.clientSeed, nonce: seeds.firstNonce,
        balance: Number(balance),
      });
    } catch (err) {
      const res = playErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }

  // Guest: a throwaway per-round seed in the client-held state blob. Not provably fair.
  return NextResponse.json(dragonTowerStart(betAmount, difficulty, freshSeeds(clientSeed)));
}
