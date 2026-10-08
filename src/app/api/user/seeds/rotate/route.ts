import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  rotateSeedPair,
  RotationBusyError,
  SeedsNotReadyError,
  NextSeedMismatchError,
  ClientSeedReusedError,
  CLIENT_SEED_PATTERN,
} from "@/lib/seed-pair";

// The client seed is required: a server-generated one could be ground against
// the already-known next server seed. The next hash the player was shown is
// echoed back, proving the commitment was published before the seed was chosen.
const schema = z.object({
  clientSeed: z.string().regex(CLIENT_SEED_PATTERN, "1–64 letters, digits, _ . or -"),
  nextServerSeedHash: z.string().regex(/^[0-9a-f]{64}$/, "the next server seed hash you were shown"),
});

// Activates the committed next server seed with the player's client seed,
// revealing the previous active seed. Open rounds on the revealed pair are
// forfeited as losses (see rotateSeedPair), so malformed input must fail
// loudly rather than rotate with defaults.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Body must be JSON: { \"clientSeed\": \"...\", \"nextServerSeedHash\": \"...\" }" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { revealed, state, forfeited } = await rotateSeedPair(session.user.id, parsed.data.clientSeed, parsed.data.nextServerSeedHash);
    return NextResponse.json({
      revealed: revealed && {
        serverSeed: revealed.serverSeed,
        serverSeedHash: revealed.serverSeedHash,
        clientSeed: revealed.clientSeed,
        nonce: revealed.nonce,
      },
      active: state.active && {
        serverSeedHash: state.active.serverSeedHash,
        clientSeed: state.active.clientSeed,
        nonce: state.active.nonce,
      },
      nextServerSeedHash: state.nextServerSeedHash,
      forfeited,
    });
  } catch (err) {
    if (err instanceof ClientSeedReusedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof RotationBusyError || err instanceof SeedsNotReadyError || err instanceof NextSeedMismatchError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
