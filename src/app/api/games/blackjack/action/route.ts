import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { blackjackAction, type BlackjackState } from "@/lib/game-engine";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { reserveBet } from "@/lib/game-balance";
import { claimRound, releaseRound, settleRound, unclaimRound, toJsonValue } from "@/lib/game-engine/round-store";
import { payloadSeedFields, hideSeed, playErrorResponse } from "@/lib/seeded-play";

type BlackjackRoundPayload = BlackjackState & { serverSeedHash: string; totalReserved: number; seedPairId?: string };

const schema = z
  .object({
    state: z.string().optional(),
    token: z.string().optional(),
    action: z.enum(["hit", "stand", "double", "split"]),
  })
  .refine((d) => !!d.state !== !!d.token, "exactly one of state or token is required");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.token) {
    const result = blackjackAction(parsed.data.state!, parsed.data.action);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const token = parsed.data.token;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const round = await claimRound<BlackjackRoundPayload>(token, session.user.id);
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  // Validate the action against the current hand first — blackjackAction works
  // on a decoded copy, so a rejected action (e.g. double on a 3-card hand)
  // leaves the round untouched. Without this, the reservation below would
  // debit the player for a move the engine then rejects, and the round would
  // be left stuck claimed.
  const encoded = Buffer.from(JSON.stringify(round.payload)).toString("base64");
  const result = blackjackAction(encoded, parsed.data.action);
  if ("error" in result) {
    // Non-terminal error — release the claim so the round stays playable.
    await releaseRound(token, round.payload);
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Double and split both add one more of the current hand's bet to total
  // exposure — reserve it up front so a bet can't outgrow the player's
  // balance mid-hand. The action is already validated, and if the reserve
  // fails we release the claim (nothing was persisted) so the player can pick
  // another move instead of losing the round.
  // Double and split add one more of the current hand's bet to the exposure.
  // That extra stake is debited in the SAME transaction as the round change it
  // pays for (the saved hand state, or the final settlement), never on its own:
  // otherwise a failure after the debit would revert the round to its
  // pre-action state with the stake gone, and a retry would debit it again.
  const extraStake =
    parsed.data.action === "double" || parsed.data.action === "split"
      ? round.payload.hands[round.payload.currentHandIndex].bet
      : 0;
  const totalReserved = round.payload.totalReserved + extraStake;
  const userId = session.user.id;

  if (result.stage === "player") {
    const newPayload: BlackjackState = JSON.parse(Buffer.from(result.state!, "base64").toString());
    try {
      await prisma.$transaction(async (tx) => {
        if (extraStake > 0) await reserveBet(userId, BigInt(extraStake), tx);
        await releaseRound(token, { ...round.payload, ...newPayload, totalReserved }, tx);
      });
    } catch (err) {
      // Nothing was committed, so the round still holds its pre-action state:
      // just unclaim it so the player can pick another move (e.g. after
      // "Insufficient balance"). unclaimRound never rewrites the payload, so
      // if the transaction did commit after all, nothing gets reverted.
      await unclaimRound(token);
      const res = playErrorResponse(err);
      if (res) return res;
      throw err;
    }
    return NextResponse.json({ ...result, state: undefined, token });
  }

  // Terminal — dealer played out, all hands settled.
  let balance: number;
  try {
    balance = Number(
      await settleRound(
        token,
        {
          userId,
          game: "blackjack",
          betAmount: BigInt(totalReserved),
          profit: BigInt(result.profit!),
          multiplier: 0,
          ...payloadSeedFields(round.payload),
          outcome: toJsonValue({ results: result.results, dealerCards: result.dealerCards }),
          reserved: true,
        },
        BigInt(extraStake) // a hand-ending double/split: debited in the settle transaction
      )
    );
  } catch (err) {
    const res = playErrorResponse(err);
    if (res) return res;
    throw err;
  }
  return NextResponse.json({ ...hideSeed(round.payload, result), balance });
}
