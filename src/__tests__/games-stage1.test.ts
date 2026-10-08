import { generateServerSeed, generateClientSeed } from "../lib/game-engine/rng";
import { resolveLimbo, getLimboWinChance } from "../lib/game-engine/limbo";
import { resolveWheel, getWheelRing, type WheelRisk, type WheelSegments } from "../lib/game-engine/wheel";
import { resolveFlip, getFlipMultiplier } from "../lib/game-engine/flip";

const ss = generateServerSeed();
const cs = generateClientSeed();

// ─── Limbo ────────────────────────────────────────────────────────────────────

describe("Limbo", () => {
  test("result is always ≥ 1.00", () => {
    for (let n = 0; n < 1000; n++) {
      expect(resolveLimbo(ss, cs, n, 1000n, 2).result).toBeGreaterThanOrEqual(1);
    }
  });

  test("win chance matches (1-edge)/target", () => {
    expect(getLimboWinChance(2)).toBeCloseTo(49.5, 1);
    expect(getLimboWinChance(10)).toBeCloseTo(9.9, 1);
  });

  test("empirical win rate ≈ theoretical for target 2×", () => {
    const N = 20_000;
    let wins = 0;
    for (let n = 0; n < N; n++) if (resolveLimbo(ss, cs, n, 1000n, 2).win) wins++;
    expect(wins / N).toBeCloseTo(0.495, 1);
  });

  test("profit pays (target-1)×bet on win, -bet on loss", () => {
    for (let n = 0; n < 200; n++) {
      const r = resolveLimbo(ss, cs, n, 10000n, 3);
      if (r.win) expect(r.profit).toBe(20000n);
      else expect(r.profit).toBe(-10000n);
    }
  });

  test("RTP ≈ 0.99 over many bets", () => {
    const N = 50_000;
    const bet = 1000n;
    let net = 0n;
    for (let n = 0; n < N; n++) net += resolveLimbo(ss, cs, n, bet, 2).profit;
    const rtp = 1 + Number(net) / (N * Number(bet));
    expect(rtp).toBeGreaterThan(0.95);
    expect(rtp).toBeLessThan(1.03);
  });
});

// ─── Wheel ────────────────────────────────────────────────────────────────────

describe("Wheel", () => {
  const RISKS: WheelRisk[] = ["low", "medium", "high"];
  const SIZES: WheelSegments[] = [10, 20, 30, 40, 50];

  test("ring length equals segment count", () => {
    for (const size of SIZES) for (const risk of RISKS) {
      expect(getWheelRing(size, risk)).toHaveLength(size);
    }
  });

  test("every ring has RTP in [0.94, 1.00]", () => {
    for (const size of SIZES) for (const risk of RISKS) {
      const ring = getWheelRing(size, risk);
      const rtp = ring.reduce((a, b) => a + b, 0) / ring.length;
      expect(rtp).toBeGreaterThanOrEqual(0.94);
      expect(rtp).toBeLessThanOrEqual(1.0);
    }
  });

  test("higher risk has a higher top multiplier", () => {
    const top = (risk: WheelRisk) => Math.max(...getWheelRing(10, risk));
    expect(top("high")).toBeGreaterThan(top("medium"));
    expect(top("medium")).toBeGreaterThan(top("low"));
  });

  test("resolveWheel lands on a real segment and matches the ring", () => {
    for (let n = 0; n < 500; n++) {
      const r = resolveWheel(ss, cs, n, 1000n, 20, "medium");
      const ring = getWheelRing(20, "medium");
      expect(r.multiplier).toBe(ring[r.segmentIndex]);
    }
  });

  test("0× segment yields full loss", () => {
    // find a losing spin
    let found = false;
    for (let n = 0; n < 1000 && !found; n++) {
      const r = resolveWheel(ss, cs, n, 10000n, 10, "high");
      if (r.multiplier === 0) { expect(r.profit).toBe(-10000n); found = true; }
    }
    expect(found).toBe(true);
  });
});

// ─── Flip ─────────────────────────────────────────────────────────────────────

describe("Flip", () => {
  test("flips array length equals target streak", () => {
    const r = resolveFlip(ss, cs, 0, 1000n, "heads", 5);
    expect(r.flips).toHaveLength(5);
  });

  test("multiplier compounds at 1.98× per flip", () => {
    expect(getFlipMultiplier(1)).toBeCloseTo(1.98, 2);
    expect(getFlipMultiplier(3)).toBeCloseTo(1.98 ** 3, 2);
  });

  test("win only when full streak matches chosen side", () => {
    for (let n = 0; n < 500; n++) {
      const r = resolveFlip(ss, cs, n, 1000n, "heads", 3);
      const allHeads = r.flips.every((f) => f === "heads");
      expect(r.win).toBe(allHeads);
    }
  });

  test("single-flip win rate ≈ 50%", () => {
    const N = 20_000;
    let wins = 0;
    for (let n = 0; n < N; n++) if (resolveFlip(ss, cs, n, 1000n, "heads", 1).win) wins++;
    expect(wins / N).toBeCloseTo(0.5, 1);
  });

  test("single-flip RTP ≈ 0.99", () => {
    const N = 40_000;
    const bet = 1000n;
    let net = 0n;
    for (let n = 0; n < N; n++) net += resolveFlip(ss, cs, n, bet, "heads", 1).profit;
    const rtp = 1 + Number(net) / (N * Number(bet));
    expect(rtp).toBeGreaterThan(0.96);
    expect(rtp).toBeLessThan(1.02);
  });
});
