import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSeedState, getRevealedPairs } from "@/lib/seed-pair";

// The player's current commitment (hashes only) plus recently revealed pairs.
// `active` is null until the player activates a pair by choosing a client seed.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [state, revealed] = await Promise.all([
    getSeedState(session.user.id),
    getRevealedPairs(session.user.id),
  ]);

  return NextResponse.json({
    active: state.active && {
      serverSeedHash: state.active.serverSeedHash,
      clientSeed: state.active.clientSeed,
      nonce: state.active.nonce,
    },
    nextServerSeedHash: state.nextServerSeedHash,
    revealed: revealed.map((p) => ({
      serverSeed: p.serverSeed,
      serverSeedHash: p.serverSeedHash,
      clientSeed: p.clientSeed,
      nonce: p.nonce,
      revealedAt: p.revealedAt?.toISOString() ?? null,
    })),
  });
}
