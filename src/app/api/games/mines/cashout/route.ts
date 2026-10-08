import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMinesMultiplier } from "@/lib/game-engine";
import { auth } from "@/auth";
import { claimRound, releaseRound, settleRound } from "@/lib/game-engine/round-store";
import { payloadSeedFields, hideSeed, playErrorResponse } from "@/lib/seeded-play";

const schema = z
  .object({
    state: z.string().optional(),
    token: z.string().optional(),
    revealedCount: z.number().int().min(1),
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
  // Server-tracked, see mines/reveal/route.ts — authoritative for authenticated play.
  revealedTiles: number[];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

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

  // Authenticated play uses the server-tracked reveal count, never the
  // client-supplied one — otherwise a client could cash out immediately after
  // starting, claiming any revealedCount, for a payout it never earned.
  // (Rounds created before revealedTiles existed default to zero reveals.)
  const revealedCount = token ? (gameState.revealedTiles ?? []).length : parsed.data.revealedCount;
  if (token && revealedCount < 1) {
    await releaseRound(token, gameState);
    return NextResponse.json({ error: "No tiles revealed yet" }, { status: 400 });
  }

  const { serverSeed, clientSeed, mineCount, minePositions, betAmount } = gameState;
  const multiplier = getMinesMultiplier(mineCount, revealedCount);
  const profit = Math.floor(betAmount * (multiplier - 1));

  let balance: number | undefined;
  if (token) {
    const session = await auth();
    try {
      balance = Number(
        await settleRound(token, {
          userId: session!.user.id,
          game: "mines",
          betAmount: BigInt(betAmount),
          profit: BigInt(profit),
          multiplier,
          ...payloadSeedFields({ ...gameState, nonce: gameState.nonce ?? 0 }),
          outcome: { minePositions, mineCount, revealedCount },
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
    ...hideSeed(gameState, { profit, multiplier, minePositions, serverSeed, clientSeed }),
    ...(gameState.nonce !== undefined ? { nonce: gameState.nonce } : {}),
    ...(balance !== undefined ? { balance } : {}),
  });
}
