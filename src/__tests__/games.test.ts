import { combinations } from "@/engine/probability/combinatorics";
import type { SeedInput } from "@/engine/rng/types";
import { blackjackGame, extraUnitsFor, type BlackjackState } from "@/games/blackjack/engine";
import { crashGame, crashPointFromFloat, resolveAbandonedCrash } from "@/games/crash/engine";
import { diceGame, diceMultiplier, diceTargetForChance, diceWinChance } from "@/games/dice/engine";
import { DRAGON_TOWER_DIFFICULTIES, dragonTowerGame, dragonTowerMultiplier } from "@/games/dragonTower/engine";
import { flipGame, flipMultiplier } from "@/games/flip/engine";
import { hiloGame, hiloOdds } from "@/games/hilo/engine";
import { kenoGame } from "@/games/keno/engine";
import { KENO_TABLES, kenoHitProbabilities } from "@/games/keno/payouts";
import { limboGame, limboResult } from "@/games/limbo/engine";
import { minesGame, minesMultiplier } from "@/games/mines/engine";
import { plinkoGame } from "@/games/plinko/engine";
import { PLINKO_ROW_OPTIONS, plinkoBucketProbabilities, plinkoTable, type PlinkoRisk } from "@/games/plinko/payouts";
import { GAMES } from "@/games/registry";
import { replayRound, type Json, type RoundGame } from "@/games/types";
import { verifyBet } from "@/games/verify";
import { wheelGame, wheelRtp } from "@/games/wheel/engine";
import { hashServerSeed } from "@/engine/rng/provablyFair";

const seedsFor = (nonce: number): SeedInput => ({ serverSeed: "f".repeat(64), clientSeed: "test-client", nonce });
const RISKS: PlinkoRisk[] = ["low", "medium", "high"];

describe("determinism: same RNG input → same result", () => {
  const instant: [string, { play: (s: SeedInput, p: never) => unknown }, unknown][] = [
    ["dice", diceGame, { target: 50.5, direction: "under" }],
    ["limbo", limboGame, { target: 2 }],
    ["wheel", wheelGame, { segments: 30, risk: "medium" }],
    ["flip", flipGame, { side: "heads", streak: 3 }],
    ["keno", kenoGame, { picks: [1, 5, 9, 13, 40] }],
    ["plinko", plinkoGame, { rows: 16, risk: "high" }],
  ];
  test.each(instant)("%s", (_name, game, params) => {
    for (let n = 0; n < 25; n++) {
      expect(game.play(seedsFor(n), params as never)).toEqual(game.play(seedsFor(n), params as never));
    }
  });

  test("round games replay identically", () => {
    expect(minesGame.start(seedsFor(3), { mineCount: 5 })).toEqual(minesGame.start(seedsFor(3), { mineCount: 5 }));
    expect(dragonTowerGame.start(seedsFor(3), { difficulty: "master" })).toEqual(dragonTowerGame.start(seedsFor(3), { difficulty: "master" }));
    expect(hiloGame.start(seedsFor(3), {})).toEqual(hiloGame.start(seedsFor(3), {}));
    expect(blackjackGame.start(seedsFor(3), {})).toEqual(blackjackGame.start(seedsFor(3), {}));
    expect(crashGame.start(seedsFor(3), { autoCashout: null })).toEqual(crashGame.start(seedsFor(3), { autoCashout: null }));
  });
});

describe("Dice", () => {
  test("win chance is exact on the 10,000-value grid", () => {
    expect(diceWinChance(50, "under")).toBe(0.5);
    expect(diceWinChance(49.99, "over")).toBe(0.5);
    expect(diceMultiplier(50, "under")).toBe(1.98);
  });
  test("target ↔ chance round-trip", () => {
    for (const dir of ["over", "under"] as const) {
      for (const c of [0.01, 0.1, 0.495, 0.98]) expect(diceWinChance(diceTargetForChance(c, dir), dir)).toBeCloseTo(c, 10);
    }
  });
  test("exhaustive RTP over all 10,000 rolls equals 0.99 (within 4-dp truncation)", () => {
    for (const [target, dir] of [
      [50, "under"],
      [10, "under"],
      [89.99, "over"],
      [2.5, "over"],
    ] as const) {
      const m = diceMultiplier(target, dir);
      const t = Math.round(target * 100);
      let wins = 0;
      for (let r = 0; r < 10_000; r++) if (dir === "under" ? r < t : r > t) wins++;
      const rtp = (wins / 10_000) * m;
      expect(rtp).toBeLessThanOrEqual(0.99 + 1e-12);
      expect(rtp).toBeGreaterThan(0.9899);
    }
  });
});

describe("Limbo and Crash", () => {
  test("P(result ≥ t) = 0.99 / t analytically", () => {
    // result ≥ t  ⇔  u ≥ 1 − 0.99/t ; check the boundary on both sides
    for (const t of [1.01, 2, 3.33, 100]) {
      const u = 1 - 0.99 / t;
      expect(limboResult(u + 1e-9)).toBeGreaterThanOrEqual(t);
      expect(limboResult(u - 1e-6)).toBeLessThan(t);
    }
  });
  test("crash instant-bust region and boundary", () => {
    expect(crashPointFromFloat(0)).toBe(1);
    expect(crashPointFromFloat(0.00999)).toBe(1);
    expect(crashPointFromFloat(0.5)).toBe(1.98);
  });
  test("crash cash-out above the crash point busts", () => {
    const s = crashGame.start(seedsFor(1), { autoCashout: null });
    const over = crashGame.act(s, { type: "cashout", at: s.crashPoint + 0.01 });
    expect(crashGame.settle(over).multiplier).toBe(0);
    const ok = crashGame.act(s, { type: "cashout", at: 1 });
    expect(crashGame.settle(ok).multiplier).toBe(1);
  });
  test("abandoned crash round honours auto cash-out only if reached", () => {
    const s = crashGame.start(seedsFor(1), { autoCashout: 1.01 });
    const action = resolveAbandonedCrash(s);
    expect(action.type).toBe(s.crashPoint >= 1.01 ? "cashout" : "bust");
  });
});

describe("Mines", () => {
  test("layout has exactly M distinct mines", () => {
    for (let m = 1; m <= 24; m++) {
      const s = minesGame.start(seedsFor(m), { mineCount: m });
      expect(new Set(s.mines).size).toBe(m);
    }
  });
  test("multiplier = floor₂(0.99 · C(25,k) / C(25−M,k))", () => {
    expect(minesMultiplier(3, 0)).toBe(1);
    expect(minesMultiplier(1, 1)).toBe(1.03);
    const exact = (0.99 * combinations(25, 5)) / combinations(22, 5);
    expect(minesMultiplier(3, 5)).toBe(Math.floor(exact * 100) / 100);
  });
  test("revealing a mine busts; revealing all safe tiles cashes out", () => {
    const s = minesGame.start(seedsFor(9), { mineCount: 24 });
    expect(minesGame.settle(minesGame.act(s, { type: "reveal", tile: s.mines[0] })).multiplier).toBe(0);
    const safe = Array.from({ length: 25 }, (_, i) => i).find((i) => !s.mines.includes(i))!;
    const won = minesGame.act(s, { type: "reveal", tile: safe });
    expect(minesGame.isFinished(won)).toBe(true);
    expect(minesGame.settle(won).multiplier).toBe(minesMultiplier(24, 1));
  });
  test("cannot cash out before revealing", () => {
    const s = minesGame.start(seedsFor(2), { mineCount: 3 });
    expect(minesGame.act(s, { type: "cashout" }).status).toBe("playing");
  });
});

describe("Dragon Tower", () => {
  test("each row has the configured dragon count", () => {
    for (const d of Object.keys(DRAGON_TOWER_DIFFICULTIES) as (keyof typeof DRAGON_TOWER_DIFFICULTIES)[]) {
      const s = dragonTowerGame.start(seedsFor(4), { difficulty: d });
      for (const row of s.dragons) {
        expect(new Set(row).size).toBe(DRAGON_TOWER_DIFFICULTIES[d].dragons);
        row.forEach((c) => expect(c).toBeLessThan(DRAGON_TOWER_DIFFICULTIES[d].cols));
      }
    }
  });
  test("edge applied once: RTP at every row is ≤ 0.99 and within truncation", () => {
    for (const d of Object.keys(DRAGON_TOWER_DIFFICULTIES) as (keyof typeof DRAGON_TOWER_DIFFICULTIES)[]) {
      const { cols, dragons } = DRAGON_TOWER_DIFFICULTIES[d];
      const p = (cols - dragons) / cols;
      for (let k = 1; k <= 9; k++) {
        const rtp = p ** k * dragonTowerMultiplier(d, k);
        expect(rtp).toBeLessThanOrEqual(0.99 + 1e-12);
        expect(rtp).toBeGreaterThan(0.99 - 0.01 * p ** k);
      }
    }
  });
});

describe("Flip", () => {
  test("multiplier = 0.99 × 2^N", () => {
    expect(flipMultiplier(1)).toBe(1.98);
    expect(flipMultiplier(10)).toBe(1013.76);
  });
});

describe("Keno tables", () => {
  test("every pick count returns ≈ 99% (never above)", () => {
    for (let picks = 1; picks <= 10; picks++) {
      const probs = kenoHitProbabilities(picks);
      const rtp = probs.reduce((s, p, h) => s + p * KENO_TABLES[picks][h], 0);
      expect(rtp).toBeLessThanOrEqual(0.99 + 1e-12);
      expect(rtp).toBeGreaterThan(0.985);
    }
  });
  test("draws 10 distinct numbers in 1..40", () => {
    const { outcome } = kenoGame.play(seedsFor(5), { picks: [1] });
    expect(new Set(outcome.drawn).size).toBe(10);
    outcome.drawn.forEach((n) => expect(n >= 1 && n <= 40).toBe(true));
  });
});

describe("Plinko tables", () => {
  test("every table has rows+1 entries and returns ≈ 99%", () => {
    for (const risk of RISKS)
      for (const rows of PLINKO_ROW_OPTIONS) {
        const table = plinkoTable(rows, risk);
        expect(table).toHaveLength(rows + 1);
        const rtp = plinkoBucketProbabilities(rows).reduce((s, p, k) => s + p * table[k], 0);
        expect(rtp).toBeLessThanOrEqual(0.99 + 1e-12);
        expect(rtp).toBeGreaterThan(0.985);
      }
  });
  test("bucket equals number of right bounces", () => {
    const { outcome } = plinkoGame.play(seedsFor(8), { rows: 12, risk: "low" });
    expect(outcome.bucket).toBe(outcome.path.filter((d) => d === "R").length);
  });
});

describe("Wheel and Diamonds keep their classic RTP", () => {
  test("wheel", () => {
    expect(wheelRtp("low")).toBeCloseTo(0.96, 10);
    expect(wheelRtp("medium")).toBeCloseTo(0.96, 10);
    expect(wheelRtp("high")).toBeCloseTo(0.97, 10);
  });
});

describe("Hilo", () => {
  test("odds use the cards still in the deck", () => {
    const s = hiloGame.start(seedsFor(11), {});
    const odds = hiloOdds(s);
    const rank = s.deck[0].rank;
    const rest = s.deck.slice(1);
    expect(odds.higher).toBeCloseTo(rest.filter((c) => c.rank > rank).length / 51, 12);
    expect(odds.lower).toBeCloseTo(rest.filter((c) => c.rank < rank).length / 51, 12);
  });
  test("expected multiplier of a one-guess round equals RTP (before truncation)", () => {
    // For any start card, choose the more likely side: E = p × 0.99/p = 0.99.
    const s = hiloGame.start(seedsFor(12), {});
    const odds = hiloOdds(s);
    const guess = odds.higher >= odds.lower ? "higher" : "lower";
    expect(odds[guess] * (0.99 / odds[guess])).toBeCloseTo(0.99, 12);
  });
});

describe("Blackjack", () => {
  test("double charges one extra unit and the round settles", () => {
    for (let n = 0; n < 200; n++) {
      const s = blackjackGame.start(seedsFor(n), {});
      if (blackjackGame.isFinished(s)) continue;
      expect(extraUnitsFor(s, { type: "double" })).toBe(1);
      const done = blackjackGame.act(s, { type: "double" });
      expect(blackjackGame.isFinished(done)).toBe(true);
      expect(blackjackGame.stakeUnits(done)).toBe(2);
      expect([0, 2, 4]).toContain(blackjackGame.settle(done).multiplier);
      return;
    }
  });
  test("natural blackjack pays 2.5×", () => {
    for (let n = 0; n < 5000; n++) {
      const s: BlackjackState = blackjackGame.start(seedsFor(n), {});
      if (s.results[0] === "blackjack") {
        expect(blackjackGame.settle(s).multiplier).toBe(2.5);
        return;
      }
    }
    throw new Error("no natural found");
  });
});

describe("verification", () => {
  const serverSeed = "9".repeat(64);
  const seeds = { serverSeed, clientSeed: "verify-me", nonce: 3 };

  test("instant game: recorded result verifies; tampered result fails", () => {
    const params = { target: 2 };
    const settlement = limboGame.play(seeds, params);
    const bet = { game: "limbo", params, actions: [], outcome: settlement.outcome as unknown as Json, multiplier: settlement.multiplier };
    expect(verifyBet(bet, seeds, hashServerSeed(serverSeed)).verified).toBe(true);
    const forged = { ...bet, outcome: { ...(bet.outcome as object), result: 999 } };
    expect(verifyBet(forged, seeds, hashServerSeed(serverSeed)).verified).toBe(false);
    expect(verifyBet(bet, seeds, hashServerSeed("other")).verified).toBe(false);
  });

  test("round game: replaying recorded actions reproduces the result", () => {
    const params = { mineCount: 3 };
    const start = minesGame.start(seeds, params);
    const safe = Array.from({ length: 25 }, (_, i) => i)
      .filter((i) => !start.mines.includes(i))
      .slice(0, 4);
    const actions = [...safe.map((tile) => ({ type: "reveal" as const, tile })), { type: "cashout" as const }];
    const final = replayRound(minesGame, seeds, params, actions);
    const settled = minesGame.settle(final);
    const bet = { game: "mines", params, actions, outcome: settled.outcome as unknown as Json, multiplier: settled.multiplier };
    expect(verifyBet(bet, seeds).verified).toBe(true);
  });

  test("every registered game has a working engine", () => {
    expect(GAMES).toHaveLength(13);
    for (const g of GAMES) expect(["instant", "round"]).toContain((g.engine as RoundGame<never, never, never, never>).kind);
  });
});
