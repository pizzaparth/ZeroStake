import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dragonTowerCashout, type DragonTowerState } from "@/lib/game-engine";
import { auth } from "@/auth";
import { claimRound, releaseRound, settleRound } from "@/lib/game-engine/round-store";
import { payloadSeedFields, hideSeed, playErrorResponse } from "@/lib/seeded-play";

type DragonTowerRoundPayload = DragonTowerState & { serverSeedHash: string; seedPairId?: string };

const schema = z
  .object({ state: z.string().optional(), token: z.string().optional() })
  .refine((d) => !!d.state !== !!d.token, "exactly one of state or token is required");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.token) {
    const result = dragonTowerCashout(parsed.data.state!);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const token = parsed.data.token;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const round = await claimRound<DragonTowerRoundPayload>(token, session.user.id);
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const encoded = Buffer.from(JSON.stringify(round.payload)).toString("base64");
  const result = dragonTowerCashout(encoded);
  if ("error" in result) {
    // Non-terminal error (e.g. no rows climbed yet) — release the claim so the
    // round stays playable instead of being stuck claimed forever.
    await releaseRound(token, round.payload);
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  let balance: number;
  try {
    balance = Number(
      await settleRound(token, {
        userId: session.user.id,
        game: "dragon_tower",
        betAmount: round.betAmount,
        profit: BigInt(result.profit),
        multiplier: result.multiplier,
        ...payloadSeedFields(round.payload),
        outcome: { currentRow: round.payload.currentRow, multiplier: result.multiplier },
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
