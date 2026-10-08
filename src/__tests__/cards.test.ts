import { generateServerSeed, generateClientSeed } from "../lib/game-engine/rng";
import {
  shuffleDeck,
  cardFromId,
  handValue,
  baccaratPoints,
  rankPokerHand,
  DECK_SIZE,
  type Card,
} from "../lib/game-engine/cards";
import { encodeState, decodeState } from "../lib/game-engine/state";

const ss = generateServerSeed();
const cs = generateClientSeed();

describe("Cards — deck integrity", () => {
  test("shuffled deck has 52 unique cards", () => {
    const deck = shuffleDeck(ss, cs, 0);
    expect(deck).toHaveLength(DECK_SIZE);
    const keys = new Set(deck.map((c) => `${c.rank}-${c.suit}`));
    expect(keys.size).toBe(DECK_SIZE);
  });

  test("shuffle is deterministic for the same seeds + nonce", () => {
    const a = shuffleDeck(ss, cs, 7);
    const b = shuffleDeck(ss, cs, 7);
    expect(a).toEqual(b);
  });

  test("different nonces produce different orderings", () => {
    const a = shuffleDeck(ss, cs, 1).map((c) => `${c.rank}-${c.suit}`).join();
    const b = shuffleDeck(ss, cs, 2).map((c) => `${c.rank}-${c.suit}`).join();
    expect(a).not.toBe(b);
  });

  test("first dealt card is roughly uniform across the deck", () => {
    const counts = new Array(DECK_SIZE).fill(0);
    const SAMPLES = 20_000;
    for (let n = 0; n < SAMPLES; n++) {
      const top = shuffleDeck(ss, cs, n)[0];
      const id = (["hearts", "diamonds", "clubs", "spades"].indexOf(top.suit)) * 13 + (top.rank - 1);
      counts[id]++;
    }
    const expected = SAMPLES / DECK_SIZE;
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.6);
      expect(c).toBeLessThan(expected * 1.4);
    }
  });
});

describe("Cards — blackjack handValue", () => {
  const C = (rank: number, suit: Card["suit"] = "spades"): Card => ({ rank, suit });

  test("ace + king is a blackjack (21)", () => {
    const v = handValue([C(1), C(13)]);
    expect(v.total).toBe(21);
    expect(v.blackjack).toBe(true);
    expect(v.soft).toBe(true);
  });

  test("ace counts as 1 when 11 would bust", () => {
    const v = handValue([C(13), C(9), C(1)]); // 10 + 9 + 1 = 20
    expect(v.total).toBe(20);
    expect(v.soft).toBe(false);
  });

  test("face cards are worth 10", () => {
    expect(handValue([C(11), C(12)]).total).toBe(20);
  });

  test("two aces = 12 (one soft)", () => {
    const v = handValue([C(1), C(1)]);
    expect(v.total).toBe(12);
  });
});

describe("Cards — baccarat points", () => {
  const C = (rank: number): Card => ({ rank, suit: "hearts" });
  test("tens and faces are worth 0", () => {
    expect(baccaratPoints([C(10), C(13)])).toBe(0);
  });
  test("total wraps modulo 10", () => {
    expect(baccaratPoints([C(7), C(8)])).toBe(5); // 15 → 5
  });
});

describe("Cards — poker ranking", () => {
  const H = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });

  test("royal flush", () => {
    const hand = [H(1, "hearts"), H(13, "hearts"), H(12, "hearts"), H(11, "hearts"), H(10, "hearts")];
    expect(rankPokerHand(hand).category).toBe("royal_flush");
  });

  test("four of a kind", () => {
    const hand = [H(8, "hearts"), H(8, "diamonds"), H(8, "clubs"), H(8, "spades"), H(2, "hearts")];
    expect(rankPokerHand(hand).category).toBe("four_of_a_kind");
  });

  test("full house", () => {
    const hand = [H(5, "hearts"), H(5, "diamonds"), H(5, "clubs"), H(9, "spades"), H(9, "hearts")];
    expect(rankPokerHand(hand).category).toBe("full_house");
  });

  test("wheel straight A-2-3-4-5", () => {
    const hand = [H(1, "hearts"), H(2, "diamonds"), H(3, "clubs"), H(4, "spades"), H(5, "hearts")];
    expect(rankPokerHand(hand).category).toBe("straight");
  });

  test("pair of jacks pays, pair of tens does not", () => {
    const jacks = [H(11, "hearts"), H(11, "diamonds"), H(2, "clubs"), H(5, "spades"), H(9, "hearts")];
    const tens = [H(10, "hearts"), H(10, "diamonds"), H(2, "clubs"), H(5, "spades"), H(9, "hearts")];
    expect(rankPokerHand(jacks).category).toBe("jacks_or_better");
    expect(rankPokerHand(tens).category).toBe("nothing");
  });
});

describe("State codec", () => {
  test("round-trips an object", () => {
    const state = { foo: 1, bar: ["a", "b"], nested: { x: true } };
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  test("returns null on malformed input", () => {
    expect(decodeState("!!!not-base64-json!!!")).toBeNull();
  });
});

describe("cardFromId", () => {
  test("maps 0–51 to all distinct cards", () => {
    const all = new Set(Array.from({ length: 52 }, (_, i) => {
      const c = cardFromId(i);
      return `${c.rank}-${c.suit}`;
    }));
    expect(all.size).toBe(52);
  });
});
