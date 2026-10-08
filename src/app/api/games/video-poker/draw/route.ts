import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { videoPokerDraw, type VideoPokerState } from "@/lib/game-engine";
import { auth } from "@/auth";
import { claimRound, releaseRound, settleRound, toJsonValue } from "@/lib/game-engine/round-store";
import { payloadSeedFields, hideSeed, playErrorResponse } from "@/lib/seeded-play";

type VideoPokerRoundPayload = VideoPokerState & { serverSeedHash: string; seedPairId?: string };

const schema = z
  .object({
    state: z.string().optional(),
    token: z.string().optional(),
    holds: z.array(z.boolean()).length(5),
  })
  .refine((d) => !!d.state !== !!d.token, "exactly one of state or token is required");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.token) {
    const result = videoPokerDraw(parsed.data.state!, parsed.data.holds);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const token = parsed.data.token;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const round = await claimRound<VideoPokerRoundPayload>(token, session.user.id);
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const encoded = Buffer.from(JSON.stringify(round.payload)).toString("base64");
  const result = videoPokerDraw(encoded, parsed.data.holds);
  if ("error" in result) {
    // Non-terminal error: release the claim so the round stays playable
    // instead of stuck claimed (which would also block seed rotation).
    await releaseRound(token, round.payload);
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  let balance: number;
  try {
    balance = Number(
      await settleRound(token, {
        userId: session.user.id,
        game: "video_poker",
        betAmount: round.betAmount,
        profit: BigInt(result.profit),
        multiplier: result.multiplier,
        ...payloadSeedFields(round.payload),
        outcome: toJsonValue({ finalHand: result.finalHand, category: result.category, holds: parsed.data.holds }),
        reserved: true,
      })
    );
  } catch (err) {
    const res = playErrorResponse(err);
    if (res) return res;
    throw err;
  }

  return NextResponse.json({ ...hideSeed(round.payload, result), balance });
}
