import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  generateOutcome,
  verifyBet,
  freshSeeds,
} from "../lib/game-engine/rng";
import { resolveDice, getDiceMultiplier } from "../lib/game-engine/dice";
import { getCrashPoint, resolveCrashBet } from "../lib/game-engine/crash";
import { generateMinePositions, getMinesMultiplier, isMine } from "../lib/game-engine/mines";
import { resolvePlinko, getMultiplierTable } from "../lib/game-engine/plinko";
import { blackjackStart } from "../lib/game-engine/blackjack";

// ─── RNG ────────────────────────────────────────────────────────────────────

describe("RNG", () => {
  const serverSeed = generateServerSeed();
  const clientSeed = generateClientSeed();

  test("generateServerSeed produces 64-char hex", () => {
    expect(serverSeed).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generateClientSeed produces 16-char hex", () => {
    expect(clientSeed).toMatch(/^[0-9a-f]{16}$/);
  });

  test("hashServerSeed produces 64-char SHA256 hex", () => {
    const hash = hashServerSeed(serverSeed);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generateOutcome is deterministic", () => {
    const a = generateOutcome(serverSeed, clientSeed, 1);
    const b = generateOutcome(serverSeed, clientSeed, 1);
    expect(a).toBe(b);
  });

  test("generateOutcome is in [0, 1)", () => {
    for (let nonce = 0; nonce < 1000; nonce++) {
      const v = generateOutcome(serverSeed, clientSeed, nonce);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test("different nonces produce different outcomes", () => {
    const outcomes = new Set(
      Array.from({ length: 100 }, (_, i) =>
        generateOutcome(serverSeed, clientSeed, i)
      )
    );
    expect(outcomes.size).toBe(100);
  });

  test("verifyBet returns true for same inputs", () => {
    const outcome = generateOutcome(serverSeed, clientSeed, 42);
    expect(verifyBet(serverSeed, clientSeed, 42, outcome)).toBe(true);
  });

  test("verifyBet returns false for wrong outcome", () => {
    const outcome = generateOutcome(serverSeed, clientSeed, 42);
    expect(verifyBet(serverSeed, clientSeed, 42, outcome + 0.001)).toBe(false);
  });

  test("10,000 outcomes are roughly uniform (chi-square sanity)", () => {
    const BUCKETS = 10;
    const SAMPLES = 10_000;
    const counts = new Array(BUCKETS).fill(0);

    for (let i = 0; i < SAMPLES; i++) {
      const v = generateOutcome(serverSeed, clientSeed, i);
      const bucket = Math.floor(v * BUCKETS);
      counts[bucket]++;
    }

    const expected = SAMPLES / BUCKETS;
    // Each bucket should be within ±20% of expected (loose sanity check)
    for (const count of counts) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });
});

// ─── Dice ───────────────────────────────────────────────────────────────────

describe("Dice", () => {
  const ss = generateServerSeed();
  const cs = generateClientSeed();

  test("win probability * multiplier ≈ 0.99 (house edge 1%)", () => {
    for (const target of [25, 50, 75]) {
      for (const dir of ["over", "under"] as const) {
        const m = getDiceMultiplier(target, dir);
        const prob = dir === "over" ? (99 - target) / 100 : target / 100;
        expect(m * prob).toBeCloseTo(0.99, 1);
      }
    }
  });

  test("resolveDice returns a win when roll satisfies condition", () => {
    // Brute-force a known winning nonce for over-50
    let winNonce = -1;
    for (let n = 0; n < 1000; n++) {
      const r = resolveDice(ss, cs, n, 1000n, 50, "over");
      if (r.win) { winNonce = n; break; }
    }
    expect(winNonce).toBeGreaterThanOrEqual(0);
  });

  test("profit is positive on win, negative on loss", () => {
    for (let n = 0; n < 100; n++) {
      const r = resolveDice(ss, cs, n, 10000n, 50, "over");
      if (r.win) expect(r.profit).toBeGreaterThan(0n);
      else expect(r.profit).toBe(-10000n);
    }
  });

  test("expected value of a fair bet is -1% (mathematical check)", () => {
    // For over-50: winProb = 49/100, multiplier ≈ 0.99/0.49
    // EV = winProb * (multiplier - 1) - (1 - winProb) = -0.01
    const m = getDiceMultiplier(50, "over");
    const winProb = 49 / 100;
    const ev = winProb * (m - 1) - (1 - winProb);
    expect(ev).toBeCloseTo(-0.01, 2);
  });
});

// ─── Crash ──────────────────────────────────────────────────────────────────

describe("Crash", () => {
  const ss = generateServerSeed();
  const cs = generateClientSeed();

  test("crash point is always ≥ 1.00", () => {
    for (let n = 0; n < 1000; n++) {
      expect(getCrashPoint(ss, cs, n)).toBeGreaterThanOrEqual(1.0);
    }
  });

  test("~1% of rounds crash at exactly 1.00", () => {
    const ROUNDS = 10_000;
    const instant = Array.from({ length: ROUNDS }, (_, n) =>
      getCrashPoint(ss, cs, n)
    ).filter((p) => p === 1.0).length;

    expect(instant / ROUNDS).toBeCloseTo(0.01, 0);
  });

  test("cashout before crash → positive profit", () => {
    // Find a round that crashes above 2.00
    let nonce = 0;
    let crashPoint = 1;
    while (crashPoint < 2) crashPoint = getCrashPoint(ss, cs, ++nonce);

    const result = resolveCrashBet(1000n, 1.5, crashPoint);
    expect(result.profit).toBeGreaterThan(0n);
    expect(result.cashedOutAt).toBe(1.5);
  });

  test("cashout after crash → bust", () => {
    const result = resolveCrashBet(1000n, null, 2.5);
    expect(result.profit).toBe(-1000n);
    expect(result.cashedOutAt).toBeNull();
  });
});

// ─── Mines ──────────────────────────────────────────────────────────────────

describe("Mines", () => {
  const ss = generateServerSeed();
  const cs = generateClientSeed();

  test("mine positions are within grid bounds", () => {
    const positions = generateMinePositions(ss, cs, 0, 5);
    expect(positions).toHaveLength(5);
    for (const p of positions) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(25);
    }
  });

  test("no duplicate mine positions", () => {
    const positions = generateMinePositions(ss, cs, 0, 10);
    expect(new Set(positions).size).toBe(10);
  });

  test("multiplier increases with each safe reveal", () => {
    const mineCount = 3;
    let prev = 1;
    for (let revealed = 1; revealed <= 5; revealed++) {
      const m = getMinesMultiplier(mineCount, revealed);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });

  test("isMine returns correct boolean", () => {
    const positions = generateMinePositions(ss, cs, 0, 5);
    expect(isMine(positions[0], positions)).toBe(true);
    // Find a tile not in positions
    const safe = Array.from({ length: 25 }, (_, i) => i).find(
      (i) => !positions.includes(i)
    )!;
    expect(isMine(safe, positions)).toBe(false);
  });
});

// ─── Plinko ─────────────────────────────────────────────────────────────────

describe("Plinko", () => {
  const ss = generateServerSeed();
  const cs = generateClientSeed();

  test("path length equals row count", () => {
    const r = resolvePlinko(ss, cs, 0, 1000n, 8, "low");
    expect(r.path).toHaveLength(8);
  });

  test("bucket index is within bounds", () => {
    for (let n = 0; n < 100; n++) {
      const r = resolvePlinko(ss, cs, n, 1000n, 8, "medium");
      expect(r.bucketIndex).toBeGreaterThanOrEqual(0);
      expect(r.bucketIndex).toBeLessThanOrEqual(8);
    }
  });

  test("multiplier matches table at bucket index", () => {
    const r = resolvePlinko(ss, cs, 0, 1000n, 8, "high");
    const table = getMultiplierTable(8, "high");
    expect(r.multiplier).toBe(table[r.bucketIndex]);
  });

  test("path contains only L and R", () => {
    const r = resolvePlinko(ss, cs, 0, 1000n, 16, "low");
    for (const dir of r.path) {
      expect(["L", "R"]).toContain(dir);
    }
  });
});

// ─── Nonce / cursor protocol ────────────────────────────────────────────────

describe("RNG message format", () => {
  test("matches an independently computed HMAC-SHA256 vector", () => {
    // Python: hmac.new(b"server-seed-fixture", b"client-seed-fixture:7:3", sha256)
    //   → first 8 hex chars 17f02d3e → 0x17f02d3e / 2^32
    expect(generateOutcome("server-seed-fixture", "client-seed-fixture", 7, 3)).toBe(0x17f02d3e / 0x100000000);
  });

  test("cursor defaults to 0", () => {
    const ss = generateServerSeed();
    const cs = generateClientSeed();
    expect(generateOutcome(ss, cs, 5)).toBe(generateOutcome(ss, cs, 5, 0));
  });

  test("consecutive nonces share no floats, so one bet can't leak the next", () => {
    // Under a persistent seed pair, the old `nonce + offset` scheme made bet n+1's
    // 52-card shuffle reuse 50 of bet n's 51 floats.
    const ss = generateServerSeed();
    const cs = generateClientSeed();
    const draws = (nonce: number) => new Set(Array.from({ length: 51 }, (_, c) => generateOutcome(ss, cs, nonce, c)));
    const a = draws(10);
    const b = draws(11);
    expect([...a].filter((x) => b.has(x))).toEqual([]);
  });

  test("multi-draw engines draw every float from one nonce's cursors", () => {
    const ss = generateServerSeed();
    const cs = generateClientSeed();
    // Recompute the Mines Fisher-Yates by hand from cursors 0..23 of nonce 3.
    const positions = Array.from({ length: 25 }, (_, i) => i);
    for (let i = 24; i > 0; i--) {
      const j = Math.floor(generateOutcome(ss, cs, 3, 24 - i) * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    expect(generateMinePositions(ss, cs, 3, 5)).toEqual(positions.slice(0, 5));
  });

  test("stateful engines resolve deterministically from injected seeds", () => {
    const seeds = freshSeeds();
    const a = blackjackStart(10000, seeds);
    const b = blackjackStart(10000, seeds);
    expect(a.playerCards).toEqual(b.playerCards);
    expect(a.dealerUpCard).toEqual(b.dealerUpCard);
    expect(a.serverSeedHash).toBe(hashServerSeed(seeds.serverSeed));
    const c = blackjackStart(10000, { ...seeds, nonce: 1 });
    expect([...c.playerCards, c.dealerUpCard]).not.toEqual([...a.playerCards, a.dealerUpCard]);
  });
});
