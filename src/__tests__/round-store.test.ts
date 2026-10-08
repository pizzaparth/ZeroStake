// Mocks src/lib/db's Prisma client with a minimal in-memory model of the
// GameRound table — just enough to exercise claimRound's guarded updateMany
// (the fix for the settlement race: two callers racing for the same token
// must not both win the claim) without a database. Mirrors the mock style
// in game-balance.test.ts.

interface FakeGameRound {
  id: string;
  userId: string;
  betAmount: bigint;
  payload: unknown;
  createdAt: Date;
  claimedAt: Date | null;
}

const rounds = new Map<string, FakeGameRound>();

function seedRound(round: FakeGameRound) {
  rounds.set(round.id, round);
}

const gameRoundModel = {
  findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
    const round = rounds.get(where.id);
    return round ? { ...round } : null;
  }),
  // claimRound's guarded claim (claimedAt: null), and settleRound's claim
  // release after a failed settlement (claimedAt: { not: null }).
  updateMany: jest.fn(async ({ where, data }: { where: { id: string; claimedAt: null | { not: null } }; data: { claimedAt: Date | null } }) => {
    const round = rounds.get(where.id);
    if (!round) return { count: 0 };
    const wantClaimed = where.claimedAt !== null;
    if (wantClaimed ? round.claimedAt === null : round.claimedAt !== null) return { count: 0 };
    round.claimedAt = data.claimedAt;
    return { count: 1 };
  }),
  update: jest.fn(async ({ where, data }: { where: { id: string }; data: { payload: unknown; claimedAt: Date | null } }) => {
    const round = rounds.get(where.id);
    if (!round) throw new Error("round not found");
    round.payload = data.payload;
    round.claimedAt = data.claimedAt;
    return { ...round };
  }),
  delete: jest.fn(async ({ where }: { where: { id: string } }) => {
    const round = rounds.get(where.id);
    if (!round) throw new Error("round not found");
    rounds.delete(where.id);
    return { ...round };
  }),
  // settleRound's guarded delete: only a round that is still claimed.
  deleteMany: jest.fn(async ({ where }: { where: { id: string; claimedAt: { not: null } } }) => {
    const round = rounds.get(where.id);
    if (!round || round.claimedAt === null) return { count: 0 };
    rounds.delete(where.id);
    return { count: 1 };
  }),
};

// Just enough for settleBet's reserved path, which settleRound calls.
const balances = new Map<string, bigint>();
const settled: unknown[] = [];
const userModel = {
  // reserveBet's guarded debit (settleRound's extraReserve).
  updateMany: jest.fn(async ({ where, data }: { where: { id: string; balance: { gte: bigint } }; data: { balance: { decrement: bigint } } }) => {
    const balance = balances.get(where.id) ?? 0n;
    if (balance < where.balance.gte) return { count: 0 };
    balances.set(where.id, balance - data.balance.decrement);
    return { count: 1 };
  }),
  findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, balance: balances.get(where.id) ?? 0n })),
  update: jest.fn(async ({ where, data }: { where: { id: string }; data: { balance: { increment: bigint } } }) => {
    const balance = (balances.get(where.id) ?? 0n) + data.balance.increment;
    balances.set(where.id, balance);
    return { id: where.id, balance };
  }),
};
const gameSessionModel = {
  create: jest.fn(async ({ data }: { data: unknown }) => {
    settled.push(data);
    return data;
  }),
};

interface FakePrismaClient {
  gameRound: typeof gameRoundModel;
  user: typeof userModel;
  gameSession: typeof gameSessionModel;
  $transaction: (fn: (tx: FakePrismaClient) => Promise<unknown>) => Promise<unknown>;
}

const fakePrisma: FakePrismaClient = {
  gameRound: gameRoundModel,
  user: userModel,
  gameSession: gameSessionModel,
  $transaction: jest.fn(async (fn: (tx: FakePrismaClient) => Promise<unknown>) => fn(fakePrisma)),
};

jest.mock("@/lib/db", () => ({ prisma: fakePrisma }));

import { claimRound, releaseRound, resolveRound, settleRound, RoundGoneError } from "../lib/game-engine/round-store";

beforeEach(() => {
  rounds.clear();
  balances.clear();
  settled.length = 0;
  jest.clearAllMocks();
});

describe("claimRound", () => {
  test("returns the round's payload on a fresh, unclaimed round", async () => {
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: { foo: "bar" }, createdAt: new Date(), claimedAt: null });
    const claimed = await claimRound<{ foo: string }>("r1", "u1");
    expect(claimed).toMatchObject({ betAmount: 10_00n, payload: { foo: "bar" } });
  });

  test("a second concurrent claim on the same token returns null — this is the fix for the double-settle race", async () => {
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: null });
    const [first, second] = await Promise.all([claimRound("r1", "u1"), claimRound("r1", "u1")]);
    const winners = [first, second].filter((r) => r !== null);
    expect(winners).toHaveLength(1);
  });

  test("returns null for a nonexistent token", async () => {
    expect(await claimRound("missing", "u1")).toBeNull();
  });

  test("returns null when the round belongs to a different user", async () => {
    seedRound({ id: "r1", userId: "owner", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: null });
    expect(await claimRound("r1", "attacker")).toBeNull();
  });

  test("returns null for an already-claimed round even from the owning user", async () => {
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: new Date() });
    expect(await claimRound("r1", "u1")).toBeNull();
  });
});

describe("releaseRound", () => {
  test("persists the new payload and clears the claim so the round can be claimed again", async () => {
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: { step: 1 }, createdAt: new Date(), claimedAt: new Date() });
    await releaseRound("r1", { step: 2 });
    const reclaimed = await claimRound<{ step: number }>("r1", "u1");
    expect(reclaimed?.payload).toEqual({ step: 2 });
  });
});

describe("resolveRound", () => {
  test("deletes the round", async () => {
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: new Date() });
    await resolveRound("r1");
    expect(rounds.has("r1")).toBe(false);
  });

  test("is idempotent — resolving an already-deleted round does not throw", async () => {
    await expect(resolveRound("missing")).resolves.toBeUndefined();
  });
});

describe("settleRound", () => {
  const params = {
    userId: "u1", game: "mines" as const, betAmount: 10_00n, profit: 5_00n, multiplier: 1.5,
    serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 3, outcome: {}, reserved: true, seedPairId: "p1",
  };

  test("deletes the claimed round and settles it in one step", async () => {
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: null });
    await claimRound("r1", "u1");
    await expect(settleRound("r1", params)).resolves.toBe(15_00n);
    expect(rounds.has("r1")).toBe(false);
    expect(settled).toEqual([expect.objectContaining({ nonce: 3, seedPairId: "p1" })]);
  });

  test("refuses a round that's gone (e.g. forfeited by a seed rotation) without settling", async () => {
    await expect(settleRound("missing", params)).rejects.toBeInstanceOf(RoundGoneError);
    expect(settled).toHaveLength(0);
  });

  test("refuses an unclaimed round, since only the claim holder may settle", async () => {
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: null });
    await expect(settleRound("r1", params)).rejects.toBeInstanceOf(RoundGoneError);
    expect(rounds.has("r1")).toBe(true);
    expect(settled).toHaveLength(0);
  });

  test("a second settle of the same round fails, so it can't pay twice", async () => {
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: null });
    await claimRound("r1", "u1");
    await settleRound("r1", params);
    await expect(settleRound("r1", params)).rejects.toBeInstanceOf(RoundGoneError);
    expect(settled).toHaveLength(1);
  });
});

describe("settleRound failure", () => {
  test("releases the claim when the settlement itself fails, so the round isn't stuck", async () => {
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: null });
    await claimRound("r1", "u1");
    userModel.update.mockRejectedValueOnce(new Error("connection reset"));

    await expect(
      settleRound("r1", {
        userId: "u1", game: "mines", betAmount: 10_00n, profit: 0n, multiplier: 1,
        serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 0, outcome: {}, reserved: true,
      })
    ).rejects.toThrow("connection reset");
    // The in-memory mock doesn't roll back the delete like Postgres would, so
    // check the release call itself.
    expect(gameRoundModel.updateMany).toHaveBeenLastCalledWith({
      where: { id: "r1", claimedAt: { not: null } },
      data: { claimedAt: null },
    });
  });
});

describe("settleRound extraReserve", () => {
  const params = {
    userId: "u1", game: "blackjack" as const, betAmount: 20_00n, profit: 20_00n, multiplier: 0,
    serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 0, outcome: {}, reserved: true,
  };

  test("debits a hand-ending double's extra stake in the settle transaction", async () => {
    balances.set("u1", 50_00n); // 10.00 already reserved at start, not in this balance
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: null });
    await claimRound("r1", "u1");
    // double: +10.00 stake, total 20.00 reserved, won 20.00 → credit 40.00
    await expect(settleRound("r1", params, 10_00n)).resolves.toBe(80_00n);
    expect(rounds.has("r1")).toBe(false);
  });

  test("fails without settling, and releases the claim, when the extra stake isn't affordable", async () => {
    balances.set("u1", 5_00n);
    seedRound({ id: "r1", userId: "u1", betAmount: 10_00n, payload: {}, createdAt: new Date(), claimedAt: null });
    await claimRound("r1", "u1");
    await expect(settleRound("r1", params, 10_00n)).rejects.toThrow("Insufficient balance");
    expect(settled).toHaveLength(0);
    expect(gameRoundModel.updateMany).toHaveBeenLastCalledWith({
      where: { id: "r1", claimedAt: { not: null } },
      data: { claimedAt: null },
    });
  });
});
