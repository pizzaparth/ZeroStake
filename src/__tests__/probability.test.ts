import { binomial, combinations, hypergeometric, survivalProbability } from "@/engine/probability/combinatorics";
import { fisherYatesShuffle, sampleWithoutReplacement, scalePayoutTable, tableReturn } from "@/engine/probability/distributions";
import { expectedReturn, expectedValue } from "@/engine/probability/expectedValue";
import { floorTo, houseEdge, multiplierForProbability } from "@/engine/probability/houseEdge";
import { coinsToCents, formatCoins, parseCoins, payoutFor } from "@/engine/wallet/money";
import { applyBet, applyPayout, canAfford } from "@/engine/wallet/wallet";

describe("combinatorics", () => {
  test("combinations", () => {
    expect(combinations(25, 3)).toBe(2300);
    expect(combinations(40, 10)).toBe(847660528);
    expect(combinations(5, 0)).toBe(1);
    expect(combinations(5, 6)).toBe(0);
  });

  test("hypergeometric sums to 1", () => {
    for (let picks = 1; picks <= 10; picks++) {
      let total = 0;
      for (let h = 0; h <= picks; h++) total += hypergeometric(40, 10, picks, h);
      expect(total).toBeCloseTo(1, 12);
    }
  });

  test("binomial sums to 1", () => {
    let total = 0;
    for (let k = 0; k <= 16; k++) total += binomial(16, k);
    expect(total).toBeCloseTo(1, 12);
  });

  test("survival probability equals C(N−M, k) / C(N, k)", () => {
    for (const [n, m, k] of [
      [25, 3, 5],
      [25, 24, 1],
      [25, 1, 24],
      [12, 3, 4],
    ]) {
      expect(survivalProbability(n, m, k)).toBeCloseTo(combinations(n - m, k) / combinations(n, k), 12);
    }
  });
});

describe("house edge and expected value", () => {
  test("house edge = 1 − RTP", () => expect(houseEdge(0.99)).toBeCloseTo(0.01, 12));
  test("multiplier = RTP / P", () => expect(multiplierForProbability(0.5, 0.99)).toBeCloseTo(1.98, 12));
  test("expected return and EV", () => {
    const outcomes = [
      { probability: 0.5, multiplier: 1.98 },
      { probability: 0.5, multiplier: 0 },
    ];
    expect(expectedReturn(outcomes)).toBeCloseTo(0.99, 12);
    expect(expectedValue(outcomes)).toBeCloseTo(-0.01, 12);
  });
  test("floorTo never rounds up and absorbs binary noise", () => {
    expect(floorTo(1.98 * 100, 0)).toBe(198);
    expect(floorTo(1.0399999, 2)).toBe(1.03);
  });
});

describe("sampling without replacement", () => {
  const seq = (values: number[]) => (i: number) => values[i % values.length];

  test("shuffle is a permutation", () => {
    const out = fisherYatesShuffle(52, seq([0.13, 0.77, 0.42, 0.99, 0.01]));
    expect([...out].sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  test("sample yields distinct values in range", () => {
    const out = sampleWithoutReplacement(40, 10, seq([0.999, 0.5, 0, 0.25]));
    expect(new Set(out).size).toBe(10);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(40);
    }
  });

  test("each position is equally likely (exhaustive over a 3-item pool)", () => {
    // With floats on an exact grid every swap index is equally likely, so all 6 orders appear equally.
    const counts = new Map<string, number>();
    for (const a of [0, 1 / 3, 2 / 3])
      for (const b of [0, 0.5]) {
        const key = fisherYatesShuffle(3, seq([a, b])).join();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    expect(counts.size).toBe(6);
  });
});

describe("payout table scaling", () => {
  test("scaled table returns the target RTP (never above)", () => {
    const probs = [0.25, 0.5, 0.25];
    const table = scalePayoutTable(probs, [4, 0.2, 4], 0.99);
    const rtp = tableReturn(probs, table);
    expect(rtp).toBeLessThanOrEqual(0.99);
    expect(rtp).toBeGreaterThan(0.985);
  });
});

describe("wallet money", () => {
  test("cents conversion and parsing", () => {
    expect(coinsToCents(10_000)).toBe(1_000_000);
    expect(parseCoins("1,234.5")).toBe(123_450);
    expect(parseCoins("1.234")).toBeNull();
    expect(parseCoins("abc")).toBeNull();
    expect(formatCoins(123_456)).toBe("1,234.56");
  });

  test("payout truncates to whole cents", () => {
    expect(payoutFor(100, 1.98)).toBe(198);
    expect(payoutFor(333, 1.5)).toBe(499);
    expect(payoutFor(100, 0)).toBe(0);
  });

  test("balance rules", () => {
    expect(canAfford(100, 100)).toBe(true);
    expect(canAfford(100, 101)).toBe(false);
    expect(() => applyBet(100, 101)).toThrow();
    expect(applyBet(100, 40)).toBe(60);
    expect(applyPayout(60, 80)).toBe(140);
    expect(() => applyPayout(60, -1)).toThrow();
  });
});
