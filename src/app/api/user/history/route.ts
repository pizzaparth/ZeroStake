import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 20;
// Anything malformed (?page=abc, -1, 1.5, huge) falls back to the first page
// instead of reaching Prisma as NaN / out-of-range and 500ing.
const pageSchema = z.coerce.number().int().min(0).max(10_000).catch(0);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const page = pageSchema.parse(req.nextUrl.searchParams.get("page") ?? 0);

  const sessions = await prisma.gameSession.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true, game: true, betAmount: true, profit: true, multiplier: true,
      serverSeed: true, serverSeedHash: true, clientSeed: true, nonce: true, createdAt: true,
      seedPair: { select: { status: true } },
    },
  });

  const hasMore = sessions.length > PAGE_SIZE;
  const page_ = sessions.slice(0, PAGE_SIZE).map((s) => ({
    id: s.id,
    game: s.game,
    betAmount: Number(s.betAmount),
    profit: Number(s.profit),
    multiplier: s.multiplier,
    // A seed pair's server seed also covers the player's future bets, so it's
    // only shown once the pair is revealed (rotated). Bets from before seed
    // pairs used a per-bet seed that was revealed at the time.
    serverSeed: !s.seedPair || s.seedPair.status === "revealed" ? s.serverSeed : null,
    serverSeedHash: s.serverSeedHash,
    clientSeed: s.clientSeed,
    nonce: s.nonce,
    createdAt: s.createdAt.toISOString(),
  }));

  return NextResponse.json({ sessions: page_, hasMore });
}
