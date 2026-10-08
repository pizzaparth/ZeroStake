import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { blackjackStart, freshSeeds, type BlackjackState } from "@/lib/game-engine";
import { auth } from "@/auth";
import { reserveBet, settleBet } from "@/lib/game-balance";
import { withSeeds, pairFields, hideSeed, playErrorResponse } from "@/lib/seeded-play";
import { createRound, toJsonValue } from "@/lib/game-engine/round-store";

const schema = z.object({
  betAmount: z.number().int().min(100).max(10_000_00),
  clientSeed: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { betAmount, clientSeed } = parsed.data;

  // Account holders: the hand resolves against the active seed pair, with the
  // nonce, bet reservation and round creation (or, for a natural, the whole
  // settlement) in one transaction. The server seed stays secret until the
  // player rotates, so it's stripped from the response.
  const session = await auth();
  if (session?.user?.id) {
    const userId = session.user.id;
    try {
      const out = await withSeeds(userId, 1, async (tx, seeds) => {
        const result = blackjackStart(betAmount, { serverSeed: seeds.serverSeed, clientSeed: seeds.clientSeed, nonce: seeds.firstNonce });
        const reserved = await reserveBet(userId, BigInt(betAmount), tx);

        // Natural (dealer or player blackjack): terminal right away, no round to persist.
        if (result.stage === "done") {
          const balance = await settleBet(
            {
              userId,
              game: "blackjack",
              betAmount: BigInt(betAmount),
              profit: BigInt(result.profit!),
              multiplier: 0,
              ...pairFields(seeds),
              outcome: toJsonValue({ result: result.result, playerCards: result.playerCards, dealerCards: result.dealerCards }),
              reserved: true,
            },
            tx
          );
          return { result, seeds, balance, token: undefined };
        }

        const payload: BlackjackState = JSON.parse(Buffer.from(result.state!, "base64").toString());
        const token = await createRound(
          userId, "blackjack", BigInt(betAmount),
          { ...payload, serverSeedHash: result.serverSeedHash, seedPairId: seeds.seedPairId, totalReserved: betAmount },
          tx
        );
        return { result, seeds, balance: reserved, token };
      });

      const { result, seeds, balance, token } = out;
      const seedView = { serverSeedHash: seeds.serverSeedHash, clientSeed: seeds.clientSeed, nonce: seeds.firstNonce, balance: Number(balance) };
      if (!token) {
        return NextResponse.json({ ...hideSeed({ seedPairId: seeds.seedPairId }, result), ...seedView });
      }
      return NextResponse.json({
        playerCards: result.playerCards, dealerUpCard: result.dealerUpCard, token,
        canDouble: result.canDouble, canSplit: result.canSplit, stage: result.stage, ...seedView,
      });
    } catch (err) {
      const res = playErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }

  // Guest: a throwaway per-round seed in the client-held state blob. Not provably fair.
  return NextResponse.json(blackjackStart(betAmount, freshSeeds(clientSeed)));
}
