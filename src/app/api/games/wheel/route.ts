import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  resolveWheel,
  getWheelRing,
  type WheelSegments,
  type WheelRisk,
} from "@/lib/game-engine";
import { auth } from "@/auth";
import { settleBet } from "@/lib/game-balance";
import { withSeeds, pairFields, playErrorResponse } from "@/lib/seeded-play";

const schema = z.object({
  betAmount: z.number().int().min(100).max(10_000_00),
  segments: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(40), z.literal(50)]),
  risk: z.enum(["low", "medium", "high"]),
  clientSeed: z.string().optional(),
  nonce: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { betAmount, segments, risk, clientSeed: suppliedClient, nonce = 0 } = parsed.data;
  const resolve = (serverSeed: string, clientSeed: string, nonce: number) =>
    resolveWheel(serverSeed, clientSeed, nonce, BigInt(betAmount), segments as WheelSegments, risk as WheelRisk);
  const view = (result: ReturnType<typeof resolve>) => ({
    segmentIndex: result.segmentIndex,
    multiplier: result.multiplier,
    profit: Number(result.profit),
    ring: getWheelRing(segments as WheelSegments, risk as WheelRisk),
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
            game: "wheel",
            betAmount: BigInt(betAmount),
            profit: result.profit,
            multiplier: result.multiplier,
            ...pairFields(seeds),
            outcome: { segmentIndex: result.segmentIndex, segments, risk },
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
