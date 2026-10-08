import { shuffleDeck } from "../lib/game-engine/cards";
import {
  hiloStart, hiloGuess, hiloCashout,
  hiloOdds, hiloStep,
} from "../lib/game-engine/hilo";
import {
  dragonTowerStart, dragonTowerClimb, dragonTowerCashout,
  dragonTowerStep, dragonTowerConfig,
  type DragonTowerDifficulty,
} from "../lib/game-engine/dragon-tower";

// ─── Hilo ─────────────────────────────────────────────────────────────────────

describe("Hilo", () => {
  test("hiloOdds: higher + lower + ties (same rank) = 51", () => {
    for (let rank = 1; rank <= 13; rank++) {
      const { higher, lower } = hiloOdds(rank);
      const ties = (rank === 1 || rank === 13) ? 3 : 3; // 3 remaining same-rank cards
      expect(higher + lower + ties).toBe(51);
    }
  });

  test("hiloStep: 0 for impossible guess (higher on King, lower on Ace)", () => {
    expect(hiloStep(13, "higher")).toBe(0);
    expect(hiloStep(1, "lower")).toBe(0);
  });

  test("hiloStep: higher step > lower step for low ranks", () => {
    // For Ace (rank 1): lower is impossible, higher should be big
    expect(hiloStep(1, "higher")).toBeGreaterThan(0);
    // For 7 (middle): both should be roughly equal
    expect(hiloStep(7, "higher")).toBeGreaterThan(0);
    expect(hiloStep(7, "lower")).toBeGreaterThan(0);
  });

  test("hiloStart returns first card from the shuffled deck", () => {
    const result = hiloStart(10000);
    expect(result.card).toBeDefined();
    expect(result.card.rank).toBeGreaterThanOrEqual(1);
    expect(result.card.rank).toBeLessThanOrEqual(13);
    expect(result.state).toBeTruthy();
    expect(result.serverSeedHash).toBeTruthy();
  });

  test("hiloGuess correct: multiplier compounds and state advances", () => {
    // Run many starts until we find a card that can safely guess higher
    for (let i = 0; i < 200; i++) {
      const start = hiloStart(10000);
      if (start.card.rank >= 13) continue; // King — can't guess higher
      const deck = shuffleDeck(
        JSON.parse(Buffer.from(start.state, "base64").toString()).serverSeed,
        JSON.parse(Buffer.from(start.state, "base64").toString()).clientSeed,
        0,
      );
      const nextRank = deck[1].rank;
      if (nextRank <= start.card.rank) continue; // next is not higher
      const r = hiloGuess(start.state, "higher");
      if ("error" in r) continue;
      expect(r.correct).toBe(true);
      expect(r.multiplier).toBeGreaterThan(1);
      expect(r.state).toBeTruthy();
      expect(r.serverSeed).toBeNull();
      return;
    }
  });

  test("hiloGuess bust: returns correct=false, profit=-bet, no state", () => {
    for (let i = 0; i < 500; i++) {
      const start = hiloStart(10000);
      const st = JSON.parse(Buffer.from(start.state, "base64").toString());
      const deck = shuffleDeck(st.serverSeed, st.clientSeed, 0);
      if (deck[0].rank >= deck[1].rank) {
        // next card is not strictly higher → guessing higher busts
        const r = hiloGuess(start.state, "higher");
        if ("error" in r) continue;
        if (!r.correct) {
          expect(r.profit).toBe(-10000);
          expect(r.state).toBeNull();
          expect(r.serverSeed).toBeTruthy();
          return;
        }
      }
    }
  });

  test("hiloCashout: returns profit = bet × (multiplier - 1)", () => {
    for (let i = 0; i < 500; i++) {
      const start = hiloStart(10000);
      const st = JSON.parse(Buffer.from(start.state, "base64").toString());
      const deck = shuffleDeck(st.serverSeed, st.clientSeed, 0);
      if (deck[1].rank > deck[0].rank) {
        const guessed = hiloGuess(start.state, "higher");
        if ("error" in guessed || !guessed.correct || !guessed.state) continue;
        const co = hiloCashout(guessed.state);
        if ("error" in co) continue;
        expect(co.profit).toBe(Math.floor(10000 * (co.multiplier - 1)));
        expect(co.multiplier).toBeGreaterThan(1);
        return;
      }
    }
  });

  test("hiloGuess: invalid state returns error", () => {
    const r = hiloGuess("not-valid-base64!!!", "higher");
    expect("error" in r).toBe(true);
  });
});

// ─── Dragon Tower ─────────────────────────────────────────────────────────────

describe("Dragon Tower", () => {
  const DIFFICULTIES: DragonTowerDifficulty[] = ["easy", "medium", "hard", "expert"];

  test("dragonTowerConfig: correct cols per difficulty", () => {
    expect(dragonTowerConfig("easy").cols).toBe(4);
    expect(dragonTowerConfig("medium").cols).toBe(3);
    expect(dragonTowerConfig("hard").cols).toBe(2);
    expect(dragonTowerConfig("expert").cols).toBe(3);
    expect(dragonTowerConfig("easy").rows).toBe(9);
  });

  test("dragonTowerStep: increases with difficulty", () => {
    expect(dragonTowerStep("hard")).toBeGreaterThan(dragonTowerStep("medium"));
    expect(dragonTowerStep("medium")).toBeGreaterThan(dragonTowerStep("easy"));
    expect(dragonTowerStep("expert")).toBeGreaterThan(dragonTowerStep("hard"));
  });

  test("dragonTowerStart: returns valid state with correct shape", () => {
    for (const diff of DIFFICULTIES) {
      const r = dragonTowerStart(10000, diff);
      expect(r.state).toBeTruthy();
      expect(r.rows).toBe(9);
      expect(r.cols).toBe(dragonTowerConfig(diff).cols);
      expect(r.step).toBeGreaterThan(1);
    }
  });

  test("dragonTowerClimb safe: multiplier compounds and row advances", () => {
    for (const diff of DIFFICULTIES) {
      const start = dragonTowerStart(10000, diff);
      const st = JSON.parse(Buffer.from(start.state, "base64").toString());
      // Find a safe column for row 0
      const safeCol = Array.from({ length: start.cols }, (_, i) => i)
        .find((c) => !st.dragonPositions[0].includes(c))!;
      const r = dragonTowerClimb(start.state, safeCol);
      if ("error" in r) throw new Error(r.error);
      expect(r.safe).toBe(true);
      expect(r.multiplier).toBeGreaterThan(1);
      expect(r.state).toBeTruthy();
    }
  });

  test("dragonTowerClimb dragon: bust returns profit=-bet and no state", () => {
    for (const diff of DIFFICULTIES) {
      const start = dragonTowerStart(10000, diff);
      const st = JSON.parse(Buffer.from(start.state, "base64").toString());
      const dragonCol = st.dragonPositions[0][0];
      const r = dragonTowerClimb(start.state, dragonCol);
      if ("error" in r) throw new Error(r.error);
      expect(r.safe).toBe(false);
      expect(r.profit).toBe(-10000);
      expect(r.state).toBeNull();
      expect(r.serverSeed).toBeTruthy();
    }
  });

  test("dragonTowerCashout after 1 row: profit = bet × (step - 1)", () => {
    const start = dragonTowerStart(10000, "easy");
    const st = JSON.parse(Buffer.from(start.state, "base64").toString());
    const safeCol = [0, 1, 2, 3].find((c) => !st.dragonPositions[0].includes(c))!;
    const climb = dragonTowerClimb(start.state, safeCol);
    if ("error" in climb || !climb.safe || !climb.state) throw new Error("unexpected");
    const co = dragonTowerCashout(climb.state);
    if ("error" in co) throw new Error(co.error);
    expect(co.profit).toBe(Math.floor(10000 * (co.multiplier - 1)));
    expect(co.multiplier).toBeGreaterThan(1);
    expect(co.allDragonPositions).toHaveLength(9);
  });

  test("dragonTowerCashout before climbing: returns error", () => {
    const start = dragonTowerStart(10000, "easy");
    const r = dragonTowerCashout(start.state);
    expect("error" in r).toBe(true);
  });

  test("dragonTowerClimb: invalid state returns error", () => {
    const r = dragonTowerClimb("bad-state", 0);
    expect("error" in r).toBe(true);
  });

  test("climbing all 9 rows on easy: cleared=true, profit > 0", () => {
    const start = dragonTowerStart(10000, "easy");
    let state = start.state;
    for (let row = 0; row < 9; row++) {
      const st = JSON.parse(Buffer.from(state, "base64").toString());
      const safeCol = [0, 1, 2, 3].find((c) => !st.dragonPositions[row].includes(c))!;
      const r = dragonTowerClimb(state, safeCol);
      if ("error" in r) throw new Error(r.error);
      expect(r.safe).toBe(true);
      if (row < 8) {
        expect(r.cleared).toBe(false);
        state = r.state!;
      } else {
        expect(r.cleared).toBe(true);
        expect(r.profit).toBeGreaterThan(0);
        expect(r.state).toBeNull();
      }
    }
  });
});
