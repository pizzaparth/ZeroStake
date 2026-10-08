// Mocks src/lib/db's Prisma client with a minimal in-memory model — just
// enough of the query shapes game-balance.ts actually uses (updateMany with
// a balance.gte guard, update with increment, findUniqueOrThrow,
// gameSession.create) to exercise the real transaction logic without a
// database. This is the suite's first mock; every other test file here
// exercises pure functions directly.

interface FakeUser { id: string; balance: bigint }

const users = new Map<string, FakeUser>();
const gameSessions: unknown[] = [];

function seedUser(id: string, balance: bigint) {
  users.set(id, { id, balance });
}

const userModel = {
  updateMany: jest.fn(async ({ where, data }: { where: { id: string; balance?: { gte: bigint } }; data: { balance: { decrement?: bigint; increment?: bigint } } }) => {
    const user = users.get(where.id);
    if (!user) return { count: 0 };
    if (where.balance && user.balance < where.balance.gte) return { count: 0 };
    if (data.balance.decrement !== undefined) user.balance -= data.balance.decrement;
    if (data.balance.increment !== undefined) user.balance += data.balance.increment;
    return { count: 1 };
  }),
  update: jest.fn(async ({ where, data }: { where: { id: string }; data: { balance: { increment?: bigint; decrement?: bigint } } }) => {
    const user = users.get(where.id);
    if (!user) throw new Error("user not found");
    if (data.balance.increment !== undefined) user.balance += data.balance.increment;
    if (data.balance.decrement !== undefined) user.balance -= data.balance.decrement;
    return { ...user };
  }),
  findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
    const user = users.get(where.id);
    if (!user) throw new Error("user not found");
    return { ...user };
  }),
};

const gameSessionModel = {
  create: jest.fn(async ({ data }: { data: unknown }) => {
    gameSessions.push(data);
    return data;
  }),
};

interface FakePrismaClient {
  user: typeof userModel;
  gameSession: typeof gameSessionModel;
  $transaction: (fn: (tx: FakePrismaClient) => Promise<unknown>) => Promise<unknown>;
}

const fakePrisma: FakePrismaClient = {
  user: userModel,
  gameSession: gameSessionModel,
  $transaction: jest.fn(async (fn: (tx: FakePrismaClient) => Promise<unknown>) => fn(fakePrisma)),
};

jest.mock("@/lib/db", () => ({ prisma: fakePrisma }));

import { reserveBet, settleBet, InsufficientBalanceError } from "../lib/game-balance";

const OUTCOME = { roll: 42 };

beforeEach(() => {
  users.clear();
  gameSessions.length = 0;
  jest.clearAllMocks();
});

describe("reserveBet", () => {
  test("decrements balance when affordable", async () => {
    seedUser("u1", 100_00n);
    const balance = await reserveBet("u1", 40_00n);
    expect(balance).toBe(60_00n);
    expect(users.get("u1")!.balance).toBe(60_00n);
  });

  test("throws InsufficientBalanceError and leaves balance untouched when not affordable", async () => {
    seedUser("u1", 10_00n);
    await expect(reserveBet("u1", 40_00n)).rejects.toThrow(InsufficientBalanceError);
    expect(users.get("u1")!.balance).toBe(10_00n);
  });

  test("exact balance is affordable (boundary)", async () => {
    seedUser("u1", 40_00n);
    const balance = await reserveBet("u1", 40_00n);
    expect(balance).toBe(0n);
  });
});

describe("settleBet — unreserved (stateless single-shot)", () => {
  test("applies a winning profit and records a GameSession", async () => {
    seedUser("u1", 100_00n);
    const balance = await settleBet({
      userId: "u1", game: "dice", betAmount: 10_00n, profit: 9_00n, multiplier: 1.9,
      serverSeed: "ss", serverSeedHash: "ssh", clientSeed: "cs", nonce: 0,
      outcome: OUTCOME, reserved: false,
    });
    // profit already nets the wager against the payout for the unreserved path
    expect(balance).toBe(109_00n);
    expect(gameSessions).toHaveLength(1);
    expect(gameSessions[0]).toMatchObject({ userId: "u1", game: "dice", profit: 9_00n });
  });

  test("applies a losing profit (negative delta)", async () => {
    seedUser("u1", 100_00n);
    const balance = await settleBet({
      userId: "u1", game: "dice", betAmount: 10_00n, profit: -10_00n, multiplier: 0,
      serverSeed: "ss", serverSeedHash: "ssh", clientSeed: "cs", nonce: 0,
      outcome: OUTCOME, reserved: false,
    });
    expect(balance).toBe(90_00n);
  });

  test("rejects a bet larger than balance and writes no GameSession", async () => {
    seedUser("u1", 5_00n);
    await expect(
      settleBet({
        userId: "u1", game: "dice", betAmount: 10_00n, profit: 9_00n, multiplier: 1.9,
        serverSeed: "ss", serverSeedHash: "ssh", clientSeed: "cs", nonce: 0,
        outcome: OUTCOME, reserved: false,
      })
    ).rejects.toThrow(InsufficientBalanceError);
    expect(users.get("u1")!.balance).toBe(5_00n);
    expect(gameSessions).toHaveLength(0);
  });
});

describe("settleBet — reserved (stateful terminal step)", () => {
  test("a loss credits back nothing (betAmount + profit = 0) — balance stays as reserveBet left it", async () => {
    seedUser("u1", 100_00n);
    await reserveBet("u1", 10_00n); // balance now 90_00
    const balance = await settleBet({
      userId: "u1", game: "mines", betAmount: 10_00n, profit: -10_00n, multiplier: 0,
      serverSeed: "ss", serverSeedHash: "ssh", clientSeed: "cs", nonce: 0,
      outcome: OUTCOME, reserved: true,
    });
    expect(balance).toBe(90_00n);
  });

  test("a win credits back the full payout (betAmount + profit)", async () => {
    seedUser("u1", 100_00n);
    await reserveBet("u1", 10_00n); // balance now 90_00
    const balance = await settleBet({
      userId: "u1", game: "mines", betAmount: 10_00n, profit: 15_00n, multiplier: 2.5,
      serverSeed: "ss", serverSeedHash: "ssh", clientSeed: "cs", nonce: 0,
      outcome: OUTCOME, reserved: true,
    });
    // 90_00 + (betAmount 10_00 + profit 15_00) = 115_00
    expect(balance).toBe(115_00n);
  });

  test("does not re-check affordability — the bet was already reserved", async () => {
    seedUser("u1", 0n); // balance already fully spent by an earlier reserveBet
    const balance = await settleBet({
      userId: "u1", game: "mines", betAmount: 10_00n, profit: -10_00n, multiplier: 0,
      serverSeed: "ss", serverSeedHash: "ssh", clientSeed: "cs", nonce: 0,
      outcome: OUTCOME, reserved: true,
    });
    expect(balance).toBe(0n);
  });
});
