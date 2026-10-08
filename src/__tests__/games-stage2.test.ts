import { generateServerSeed, generateClientSeed } from "../lib/game-engine/rng";
import { resolveKeno, getKenoMultiplier } from "../lib/game-engine/keno";
import { resolveDiamonds, getDiamondsMultiplier } from "../lib/game-engine/diamonds";

const ss = generateServerSeed();
const cs = generateClientSeed();

// ─── Keno ─────────────────────────────────────────────────────────────────────

describe("Keno", () => {
  test("always draws exactly 10 distinct tiles from 1–40", () => {
    for (let n = 0; n < 100; n++) {
      const r = resolveKeno(ss, cs, n, 1000n, [1, 2, 3]);
      expect(r.drawn).toHaveLength(10);
      const set = new Set(r.drawn);
      expect(set.size).toBe(10);
      r.drawn.forEach((d) => { expect(d).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(40); });
    }
  });

  test("result is deterministic with same seeds", () => {
    const a = resolveKeno("seed-a", "seed-b", 0, 1000n, [5, 10, 15]);
    const b = resolveKeno("seed-a", "seed-b", 0, 1000n, [5, 10, 15]);
    expect(a.drawn).toEqual(b.drawn);
    expect(a.hits).toBe(b.hits);
  });

  test("hits equals intersection of picks and drawn", () => {
    for (let n = 0; n < 200; n++) {
      const picks = [1, 10, 20, 30, 40];
      const r = resolveKeno(ss, cs, n, 1000n, picks);
      const manual = picks.filter((p) => r.drawn.includes(p)).length;
      expect(r.hits).toBe(manual);
    }
  });

  test("getKenoMultiplier returns 0 for below-threshold hits", () => {
    expect(getKenoMultiplier(5, 0)).toBe(0);
    expect(getKenoMultiplier(5, 1)).toBe(0);
    expect(getKenoMultiplier(5, 2)).toBe(0);
  });

  test("getKenoMultiplier 10-pick special: 0 hits pays 1.5×", () => {
    expect(getKenoMultiplier(10, 0)).toBe(1.5);
  });

  test("profit is positive on win, -bet on loss", () => {
    let sawWin = false;
    let sawLoss = false;
    for (let n = 0; n < 200 && (!sawWin || !sawLoss); n++) {
      const r = resolveKeno(ss, cs, n, 10000n, [1]);
      if (r.multiplier > 0) { expect(r.profit).toBeGreaterThan(0n); sawWin = true; }
      else { expect(r.profit).toBe(-10000n); sawLoss = true; }
    }
  });

  test("RTP in range for 1-pick over many bets", () => {
    const N = 30_000;
    const bet = 1000n;
    let net = 0n;
    // Fixed seeds for deterministic results across environments
    for (let n = 0; n < N; n++) net += resolveKeno("keno-rtp-server", "keno-rtp-client", n, bet, [1]).profit;
    const rtp = 1 + Number(net) / (N * Number(bet));
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(1.1);
  });
});

// ─── Diamonds ─────────────────────────────────────────────────────────────────

describe("Diamonds", () => {
  test("always places exactly 3 diamonds in 12 tiles", () => {
    for (let n = 0; n < 100; n++) {
      const r = resolveDiamonds(ss, cs, n, 1000n, [0, 1, 2, 3]);
      expect(r.tiles).toHaveLength(12);
      expect(r.tiles.filter((t) => t === "diamond")).toHaveLength(3);
      expect(r.diamondPositions).toHaveLength(3);
      const posSet = new Set(r.diamondPositions);
      expect(posSet.size).toBe(3);
      r.diamondPositions.forEach((p) => { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(11); });
    }
  });

  test("result is deterministic with same seeds", () => {
    const picks = [0, 3, 6, 9];
    const a = resolveDiamonds("seed-x", "seed-y", 5, 1000n, picks);
    const b = resolveDiamonds("seed-x", "seed-y", 5, 1000n, picks);
    expect(a.diamondPositions).toEqual(b.diamondPositions);
    expect(a.hits).toBe(b.hits);
  });

  test("hits equals intersection of picks and diamondPositions", () => {
    for (let n = 0; n < 200; n++) {
      const picks = [0, 3, 7, 11];
      const r = resolveDiamonds(ss, cs, n, 1000n, picks);
      const manual = picks.filter((p) => r.diamondPositions.includes(p)).length;
      expect(r.hits).toBe(manual);
    }
  });

  test("getDiamondsMultiplier returns correct table values", () => {
    expect(getDiamondsMultiplier(0)).toBe(0);
    expect(getDiamondsMultiplier(1)).toBe(0.4);
    expect(getDiamondsMultiplier(2)).toBe(2);
    expect(getDiamondsMultiplier(3)).toBe(18);
  });

  test("profit is negative on 0 hits, positive on 2+ hits", () => {
    for (let n = 0; n < 200; n++) {
      const r = resolveDiamonds(ss, cs, n, 10000n, [0, 1, 2, 3]);
      if (r.hits === 0) expect(r.profit).toBe(-10000n);
      else if (r.hits >= 2) expect(r.profit).toBeGreaterThan(0n);
    }
  });

  test("RTP ≈ 0.97 over many bets", () => {
    const N = 50_000;
    const bet = 1000n;
    let net = 0n;
    // Fixed seeds for deterministic results across environments
    for (let n = 0; n < N; n++) net += resolveDiamonds("diamonds-rtp-server", "diamonds-rtp-client", n, bet, [0, 1, 2, 3]).profit;
    const rtp = 1 + Number(net) / (N * Number(bet));
    expect(rtp).toBeGreaterThan(0.94);
    expect(rtp).toBeLessThan(1.00);
  });
});
