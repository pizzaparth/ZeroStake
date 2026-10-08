import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  getCrashPoint,
  resolveCrashBet,
  crashMultiplierAtElapsed,
} from "@/lib/game-engine";
import { auth } from "@/auth";
import { reserveBet } from "@/lib/game-balance";
import { createRound, claimRound, settleRound } from "@/lib/game-engine/round-store";
import { withSeeds, pairFields, payloadSeedFields, hideSeed, playErrorResponse, type SeededPayload } from "@/lib/seeded-play";

const startSchema = z.object({ action: z.literal("start"), betAmount: z.number().int().min(100).max(10_000_00), clientSeed: z.string().optional() });
const cashoutSchema = z.object({
  action: z.literal("cashout"),
  state: z.string().optional(),
  token: z.string().optional(),
  cashedOutAt: z.number().min(1.01).optional(),
  bust: z.boolean().optional(),
}).refine((d) => !!d.state !== !!d.token, "exactly one of state or token is required")
  .refine((d) => d.bust || d.cashedOutAt !== undefined, "cashedOutAt is required unless bust is true");
const schema = z.discriminatedUnion("action", [startSchema, cashoutSchema]);

interface CrashRoundPayload extends Omit<SeededPayload, "nonce"> {
  /** Absent on rounds started before seed pairs (which always used nonce 0). */
  nonce?: number;
  betAmount: number;
  crashPoint: number;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.action === "start") {
    const { betAmount, clientSeed: suppliedClient } = parsed.data;

    // Account holders: the crash point comes from the active seed pair, with the
    // nonce, bet reservation and round creation in one transaction.
    const session = await auth();
    if (session?.user?.id) {
      const userId = session.user.id;
      try {
        const { token, seeds, crashPoint, balance } = await withSeeds(userId, 1, async (tx, seeds) => {
          const crashPoint = getCrashPoint(seeds.serverSeed, seeds.clientSeed, seeds.firstNonce);
          const balance = await reserveBet(userId, BigInt(betAmount), tx);
          const token = await createRound(
            userId, "crash", BigInt(betAmount),
            { ...pairFields(seeds), betAmount, crashPoint } satisfies CrashRoundPayload,
            tx
          );
          return { token, seeds, crashPoint, balance };
        });
        // crashPoint is still sent: the client animates locally with no server
        // push loop, so it needs the target to run the countdown at all. The
        // cashout step below is what's actually secured (see crashMultiplierAtElapsed).
        return NextResponse.json({
          token, serverSeedHash: seeds.serverSeedHash, clientSeed: seeds.clientSeed, nonce: seeds.firstNonce,
          crashPoint, balance: Number(balance),
        });
      } catch (err) {
        const res = playErrorResponse(err);
        if (res) return res;
        throw err;
      }
    }

    // Guest: a throwaway per-round seed in a client-held blob. Not provably fair.
    const serverSeed = generateServerSeed();
    const clientSeed = suppliedClient ?? generateClientSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const crashPoint = getCrashPoint(serverSeed, clientSeed, 0);
    const state = Buffer.from(
      JSON.stringify({ serverSeed, clientSeed, betAmount, crashPoint })
    ).toString("base64");
    return NextResponse.json({ state, serverSeedHash, clientSeed, crashPoint });
  }

  // cashout
  const { cashedOutAt, bust } = parsed.data;

  if (parsed.data.token) {
    const token = parsed.data.token;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const round = await claimRound<CrashRoundPayload>(token, session.user.id);
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

    const { betAmount, crashPoint } = round.payload;

    // An explicit bust notification always settles as a loss — no numeric
    // comparison needed (and none of the elapsed-time clamp's floor-rounding
    // edge cases to worry about). Otherwise this is a win *claim*, clamped to
    // what real elapsed server time could actually have reached.
    let effectiveCashedOutAt: number | null;
    if (bust) {
      effectiveCashedOutAt = null;
    } else {
      const elapsedMs = Date.now() - round.createdAt.getTime();
      const maxReachable = crashMultiplierAtElapsed(elapsedMs);
      effectiveCashedOutAt = Math.min(cashedOutAt!, maxReachable);
    }

    const result = resolveCrashBet(BigInt(betAmount), effectiveCashedOutAt, crashPoint);

    let balance: number;
    try {
      balance = Number(
        await settleRound(token, {
          userId: session.user.id,
          game: "crash",
          betAmount: BigInt(betAmount),
          profit: result.profit,
          multiplier: result.cashedOutAt ?? 0,
          ...payloadSeedFields({ ...round.payload, nonce: round.payload.nonce ?? 0 }),
          outcome: { crashPoint, cashedOutAt: result.cashedOutAt },
          reserved: true,
        })
      );
    } catch (err) {
      const res = playErrorResponse(err);
      if (res) return res;
      throw err;
    }

    return NextResponse.json({
      ...hideSeed(round.payload, {
        crashPoint,
        cashedOutAt: result.cashedOutAt,
        profit: Number(result.profit),
        win: result.cashedOutAt !== null,
        serverSeed: round.payload.serverSeed,
        clientSeed: round.payload.clientSeed,
      }),
      nonce: round.payload.nonce ?? 0,
      balance,
    });
  }

  // Guest: opaque blob, unchanged.
  let gameState: { serverSeed: string; clientSeed: string; betAmount: number; crashPoint: number };
  try {
    gameState = JSON.parse(Buffer.from(parsed.data.state!, "base64").toString());
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  if (cashedOutAt === undefined) {
    return NextResponse.json({ error: "cashedOutAt is required for guest cashout" }, { status: 400 });
  }
  const { serverSeed, clientSeed, betAmount, crashPoint } = gameState;
  const result = resolveCrashBet(BigInt(betAmount), cashedOutAt, crashPoint);

  return NextResponse.json({
    crashPoint,
    cashedOutAt: result.cashedOutAt,
    profit: Number(result.profit),
    win: result.cashedOutAt !== null,
    serverSeed,
    clientSeed,
  });
}
