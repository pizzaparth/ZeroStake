// Mocks src/lib/db's Prisma client with a minimal in-memory model of the
// SeedPair, GameRound, User and GameSession tables: just the query shapes
// seed-pair.ts and settleBet use. Mirrors the mock style in
// game-balance.test.ts. Row locking isn't modelled; concurrency is covered by
// the e2e run against real Postgres.
import { createHash } from "crypto";

interface FakePair {
  id: string;
  userId: string;
  status: "next" | "active" | "revealed";
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string | null;
  nonce: number;
  activatedAt: Date | null;
  revealedAt: Date | null;
}
interface FakeRound { id: string; userId: string; game: string; betAmount: bigint; payload: unknown; claimedAt: Date | null }

let pairs: FakePair[] = [];
let rounds: FakeRound[] = [];
const sessions: Record<string, unknown>[] = [];
const balances = new Map<string, bigint>();
let seq = 0;

type Where = Record<string, unknown>;
function matches(row: object, where: Where): boolean {
  return Object.entries(where).every(([k, v]) => {
    const actual = (row as Record<string, unknown>)[k];
    if (v && typeof v === "object" && "in" in (v as object)) return (v as { in: unknown[] }).in.includes(actual);
    return actual === v;
  });
}

function insertPair(data: Partial<FakePair> & { userId: string; status: FakePair["status"] }): boolean {
  if (data.status !== "revealed" && pairs.some((p) => p.userId === data.userId && p.status === data.status)) return false;
  pairs.push({ id: `pair${++seq}`, serverSeed: "", serverSeedHash: "", clientSeed: null, nonce: 0, activatedAt: null, revealedAt: null, ...data });
  return true;
}

function applyData(row: FakePair, data: Record<string, unknown>) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && "increment" in (v as object)) {
      (row as unknown as Record<string, number>)[k] += (v as { increment: number }).increment;
    } else {
      (row as unknown as Record<string, unknown>)[k] = v;
    }
  }
}

const fakePrisma = {
  seedPair: {
    findMany: jest.fn(async ({ where, take }: { where: Where; take?: number }) =>
      pairs.filter((p) => matches(p, where)).slice(0, take ?? Infinity).map((p) => ({ ...p }))),
    findFirst: jest.fn(async ({ where }: { where: Where }) => {
      const p = pairs.find((row) => matches(row, where));
      return p ? { ...p } : null;
    }),
    findFirstOrThrow: jest.fn(async ({ where }: { where: Where }) => {
      const p = pairs.find((row) => matches(row, where));
      if (!p) throw new Error("not found");
      return { ...p };
    }),
    findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
      const p = pairs.find((row) => row.id === where.id);
      if (!p) throw new Error("not found");
      return { ...p };
    }),
    updateMany: jest.fn(async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
      const hit = pairs.filter((p) => matches(p, where));
      hit.forEach((p) => applyData(p, data));
      return { count: hit.length };
    }),
    createMany: jest.fn(async ({ data }: { data: (Partial<FakePair> & { userId: string; status: FakePair["status"] })[] }) => ({
      count: data.filter((d) => insertPair(d)).length,
    })),
    create: jest.fn(async ({ data }: { data: Partial<FakePair> & { userId: string; status: FakePair["status"] } }) => {
      if (!insertPair(data)) throw new Error("unique violation");
      return { ...pairs[pairs.length - 1] };
    }),
  },
  gameRound: {
    findMany: jest.fn(async ({ where }: { where: Where }) => rounds.filter((r) => matches(r, where)).map((r) => ({ ...r }))),
    deleteMany: jest.fn(async ({ where }: { where: Where }) => {
      const before = rounds.length;
      rounds = rounds.filter((r) => !matches(r, where));
      return { count: before - rounds.length };
    }),
  },
  user: {
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: { balance: { increment: bigint } } }) => {
      const balance = (balances.get(where.id) ?? 0n) + data.balance.increment;
      balances.set(where.id, balance);
      return { id: where.id, balance };
    }),
  },
  gameSession: {
    findFirst: jest.fn(async ({ where }: { where: Where }) => sessions.find((row) => matches(row, where)) ?? null),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      sessions.push(data);
      return data;
    }),
  },
  $transaction: jest.fn(runTx),
};

// A function declaration with an explicit return type breaks the
// fakePrisma ↔ $transaction inference cycle.
function runTx(fn: (tx: unknown) => Promise<unknown>): Promise<unknown> {
  return fn(fakePrisma);
}

jest.mock("@/lib/db", () => ({ prisma: fakePrisma }));

import {
  getSeedState,
  allocateNonces,
  rotateSeedPair,
  RotationBusyError,
  SeedsNotReadyError,
  NoActiveSeedPairError,
  ClientSeedReusedError,
  NextSeedMismatchError,
} from "@/lib/seed-pair";
import type { Tx } from "@/lib/game-balance";

const tx = fakePrisma as unknown as Tx;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

beforeEach(() => {
  pairs = [];
  rounds = [];
  sessions.length = 0;
  balances.clear();
  balances.set("u1", 99_000n);
});

/** Rotates the way a well-behaved client does: echoing the next hash it was shown. */
function rotate(clientSeed: string) {
  const next = pairs.find((p) => p.userId === "u1" && p.status === "next");
  return rotateSeedPair("u1", clientSeed, next?.serverSeedHash ?? "0".repeat(64));
}

/** Commits a next pair (as registration or a GET would), then activates it. */
async function activate(clientSeed = "player-seed") {
  await getSeedState("u1");
  return rotate(clientSeed);
}

describe("getSeedState", () => {
  test("commits only a next pair: no active pair until the player picks a client seed", async () => {
    const state = await getSeedState("u1");
    expect(pairs.map((p) => p.status)).toEqual(["next"]);
    const next = pairs[0];
    expect(state.active).toBeNull();
    expect(state.nextServerSeedHash).toBe(sha256(next.serverSeed));
    expect(next.clientSeed).toBeNull();
    expect(JSON.stringify(state)).not.toContain(next.serverSeed);
  });

  test("is idempotent", async () => {
    const a = await getSeedState("u1");
    const b = await getSeedState("u1");
    expect(b).toEqual(a);
    expect(pairs).toHaveLength(1);
  });
});

describe("allocateNonces", () => {
  test("rejects non-positive or fractional counts before touching the pair", async () => {
    await activate();
    for (const bad of [0, -1, 1.5]) {
      await expect(allocateNonces(tx, "u1", bad)).rejects.toBeInstanceOf(RangeError);
    }
    expect(pairs.find((p) => p.status === "active")!.nonce).toBe(0);
  });

  test("refuses before activation and never creates a pair", async () => {
    await expect(allocateNonces(tx, "u1")).rejects.toBeInstanceOf(NoActiveSeedPairError);
    expect(pairs).toHaveLength(0);
  });

  test("hands out consecutive nonces from the active pair", async () => {
    await activate();
    const first = await allocateNonces(tx, "u1");
    const second = await allocateNonces(tx, "u1");
    const multi = await allocateNonces(tx, "u1", 3);
    expect([first.firstNonce, second.firstNonce, multi.firstNonce]).toEqual([0, 1, 2]);
    expect((await allocateNonces(tx, "u1")).firstNonce).toBe(5);
    expect(first.seedPairId).toBe(pairs.find((p) => p.status === "active")!.id);
    expect(first.clientSeed).toBe("player-seed");
    expect(first.serverSeedHash).toBe(sha256(first.serverSeed));
  });
});

describe("rotateSeedPair", () => {
  test("refuses when no next seed was committed by an earlier request, and creates nothing", async () => {
    await expect(rotate("player-seed")).rejects.toBeInstanceOf(SeedsNotReadyError);
    expect(pairs).toHaveLength(0);
    await getSeedState("u1"); // a plain GET commits the next seed
    await expect(rotate("fresh-seed")).resolves.toMatchObject({ revealed: null });
  });

  test("refuses unless the client echoes the committed next hash it was shown", async () => {
    await getSeedState("u1");
    await expect(rotateSeedPair("u1", "fresh", "a".repeat(64))).rejects.toBeInstanceOf(NextSeedMismatchError);
    expect(pairs.map((p) => p.status)).toEqual(["next"]);
    await expect(rotate("fresh")).resolves.toMatchObject({ revealed: null });
  });

  test("rejects a client seed already recorded on a past bet or an open round", async () => {
    await getSeedState("u1");
    sessions.push({ userId: "u1", clientSeed: "used-in-a-bet" });
    rounds.push({ id: "r9", userId: "u1", game: "mines", betAmount: 100n, claimedAt: null, payload: { clientSeed: "in-open-round" } });
    await expect(rotate("used-in-a-bet")).rejects.toBeInstanceOf(ClientSeedReusedError);
    await expect(rotate("in-open-round")).rejects.toBeInstanceOf(ClientSeedReusedError);
    await expect(rotate("never-seen")).resolves.toBeDefined();
  });

  test("rejects a client seed this user has used before, on any pair", async () => {
    await activate("seed-a");
    await expect(rotate("seed-a")).rejects.toBeInstanceOf(ClientSeedReusedError);
    await rotate("seed-b");
    await expect(rotate("seed-a")).rejects.toBeInstanceOf(ClientSeedReusedError); // now on a revealed pair
    await expect(rotate("seed-c")).resolves.toBeDefined();
  });

  test("first activation pairs the pre-committed next seed with the player's client seed", async () => {
    const before = await getSeedState("u1");
    const { revealed, state } = await rotate("my-own-seed");
    expect(revealed).toBeNull();
    expect(state.active).toMatchObject({ serverSeedHash: before.nextServerSeedHash, clientSeed: "my-own-seed", nonce: 0 });
    expect(state.nextServerSeedHash).not.toBe(before.nextServerSeedHash);
  });

  test("later rotations reveal the active seed and promote the committed next seed", async () => {
    await activate();
    await allocateNonces(tx, "u1", 4);
    const before = await getSeedState("u1");

    const { revealed, state } = await rotate("second-seed");

    expect(sha256(revealed!.serverSeed)).toBe(before.active!.serverSeedHash);
    expect(revealed!.nonce).toBe(4);
    expect(state.active!.serverSeedHash).toBe(before.nextServerSeedHash);
    expect(state.active!.clientSeed).toBe("second-seed");
    expect(pairs.filter((p) => p.status === "revealed")).toHaveLength(1);
  });

  test("requires a well-formed client seed", async () => {
    await getSeedState("u1");
    await expect(rotate("has:colon")).rejects.toThrow("invalid client seed");
    await expect(rotate("x".repeat(65))).rejects.toThrow("invalid client seed");
    await expect(rotate("")).rejects.toThrow("invalid client seed");
  });

  test("forfeits open rounds on the revealed pair as losses, leaving other rounds alone", async () => {
    await activate();
    const activeId = pairs.find((p) => p.status === "active")!.id;
    rounds.push(
      { id: "r1", userId: "u1", game: "mines", betAmount: 1000n, claimedAt: null, payload: { nonce: 7, seedPairId: activeId } },
      { id: "legacy", userId: "u1", game: "hilo", betAmount: 500n, claimedAt: null, payload: { serverSeed: "own-seed" } },
    );

    const { forfeited, revealed } = await rotate("next-seed");

    expect(forfeited).toBe(1);
    expect(rounds.map((r) => r.id)).toEqual(["legacy"]);
    expect(balances.get("u1")).toBe(99_000n); // reserved at start; a loss credits nothing back
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      game: "mines", profit: -1000n, nonce: 7, seedPairId: activeId,
      serverSeed: revealed!.serverSeed, outcome: { forfeited: "seed rotation" },
    });
  });

  test("refuses while a round on the pair is claimed by another request", async () => {
    await activate();
    const activeId = pairs.find((p) => p.status === "active")!.id;
    rounds.push({ id: "r1", userId: "u1", game: "mines", betAmount: 1000n, payload: { seedPairId: activeId }, claimedAt: new Date(Date.now() - 60 * 60_000) });
    await expect(rotate("next-seed")).rejects.toBeInstanceOf(RotationBusyError);
  });
});
