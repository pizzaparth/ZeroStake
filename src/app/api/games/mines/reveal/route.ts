import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMinesMultiplier, isMine } from "@/lib/game-engine";
import { auth } from "@/auth";
import { claimRound, releaseRound, settleRound } from "@/lib/game-engine/round-store";
import { payloadSeedFields, playErrorResponse } from "@/lib/seeded-play";

const schema = z
  .object({
    state: z.string().optional(),
    token: z.string().optional(),
    tileIndex: z.number().int().min(0).max(24),
    revealedCount: z.number().int().min(0),
  })
  .refine((d) => !!d.state !== !!d.token, "exactly one of state or token is required");

interface MinesPayload {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  /** Absent on rounds started before seed pairs (which always used nonce 0). */
  nonce?: number;
  seedPairId?: string;
  mineCount: number;
  minePositions: number[];
  betAmount: number;
  // Tiles revealed so far, server-tracked. Authenticated play must use this —
  // not the client-supplied revealedCount — as the source of truth for the
  // payout multiplier; otherwise a client could claim any revealedCount at
  // cashout time for a payout it never actually earned.
  revealedTiles: number[];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tileIndex, revealedCount } = parsed.data;

  let gameState: MinesPayload;
  let token: string | undefined;

  if (parsed.data.token) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const round = await claimRound<MinesPayload>(parsed.data.token, session.user.id);
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    gameState = round.payload;
    token = parsed.data.token;
  } else {
    try {
      gameState = JSON.parse(Buffer.from(parsed.data.state!, "base64").toString());
    } catch {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }
  }

  const { minePositions, mineCount, betAmount } = gameState;

  // Authenticated play tracks revealed tiles server-side (gameState.revealedTiles);
  // a client can't inflate its count by replaying an already-safe tileIndex or by
  // sending a bogus revealedCount. Guest play has no persisted round to check
  // against, so it keeps trusting the client-supplied revealedCount as before —
  // an existing, documented limitation with no real balance at stake.
  // Rounds created before revealedTiles existed (pre-this-fix deploys) have no
  // such key in their persisted payload — treat them as zero reveals rather
  // than crashing on undefined.
  const revealedTiles = gameState.revealedTiles ?? [];
  if (token && revealedTiles.includes(tileIndex)) {
    await releaseRound(token, gameState);
    return NextResponse.json({ error: "Tile already revealed" }, { status: 400 });
  }

  const serverRevealedCount = token ? revealedTiles.length : revealedCount;
  const hit = isMine(tileIndex, minePositions);

  if (hit) {
    let balance: number | undefined;
    if (token) {
      const session = await auth();
      try {
        balance = Number(
          await settleRound(token, {
            userId: session!.user.id,
            game: "mines",
            betAmount: BigInt(betAmount),
            profit: BigInt(-betAmount),
            multiplier: 0,
            ...payloadSeedFields({ ...gameState, nonce: gameState.nonce ?? 0 }),
            outcome: { minePositions, mineCount, tileIndex, revealedCount: serverRevealedCount },
            reserved: true,
          })
        );
      } catch (err) {
        const res = playErrorResponse(err);
        if (res) return res;
        throw err;
      }
    }

    return NextResponse.json({
      hit: true,
      minePositions,
      profit: -betAmount,
      multiplier: 0,
      ...(balance !== undefined ? { balance } : {}),
    });
  }

  const newRevealedCount = serverRevealedCount + 1;
  const multiplier = getMinesMultiplier(mineCount, newRevealedCount);

  if (token) {
    await releaseRound(token, { ...gameState, revealedTiles: [...revealedTiles, tileIndex] });
  }

  return NextResponse.json({
    hit: false,
    multiplier,
    currentProfit: Math.floor(betAmount * (multiplier - 1)),
  });
}
