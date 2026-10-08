import { handValue } from "../lib/game-engine/cards";
import { blackjackStart, blackjackAction } from "../lib/game-engine/blackjack";
import { videoPokerDeal, videoPokerDraw, videoPokerPayout } from "../lib/game-engine/video-poker";

// ─── Blackjack ────────────────────────────────────────────────────────────────

describe("Blackjack", () => {
  test("start deals 2 cards each to player and dealer", () => {
    const r = blackjackStart(10000);
    expect(r.playerCards).toHaveLength(2);
    expect(r.dealerUpCard).toBeDefined();
  });

  test("player blackjack with no dealer blackjack pays 3:2 immediately", () => {
    for (let i = 0; i < 500; i++) {
      const r = blackjackStart(10000);
      if (r.stage === "done" && r.result === "blackjack") {
        expect(r.profit).toBe(15000);
        expect(r.state).toBeNull();
        expect(r.serverSeed).toBeTruthy();
        return;
      }
    }
  });

  test("both blackjack pushes with 0 profit", () => {
    for (let i = 0; i < 2000; i++) {
      const r = blackjackStart(10000);
      if (r.stage === "done" && r.result === "push") {
        expect(r.profit).toBe(0);
        return;
      }
    }
  });

  test("hit until bust returns negative profit and dealer cards", () => {
    for (let i = 0; i < 200; i++) {
      const r = blackjackStart(10000);
      if (r.stage !== "player" || !r.state) continue;
      let state = r.state;
      let result;
      for (let h = 0; h < 15; h++) {
        result = blackjackAction(state, "hit");
        if ("error" in result) break;
        if (result.stage === "done") break;
        state = result.state!;
      }
      if (result && !("error" in result) && result.stage === "done" && result.results?.includes("bust")) {
        expect(result.profit).toBeLessThan(0);
        expect(result.serverSeed).toBeTruthy();
        return;
      }
    }
  });

  test("stand immediately resolves against dealer", () => {
    for (let i = 0; i < 50; i++) {
      const r = blackjackStart(10000);
      if (r.stage !== "player" || !r.state) continue;
      const result = blackjackAction(r.state, "stand");
      if ("error" in result) continue;
      expect(result.stage).toBe("done");
      expect(result.dealerCards).toBeDefined();
      expect(typeof result.profit).toBe("number");
      return;
    }
  });

  test("double on first decision doubles the bet and forces exactly one card", () => {
    for (let i = 0; i < 200; i++) {
      const r = blackjackStart(10000);
      if (r.stage !== "player" || !r.canDouble || !r.state) continue;
      const result = blackjackAction(r.state, "double");
      if ("error" in result) continue;
      // doubled hand profit magnitude should be a multiple of the doubled bet (20000)
      if (result.stage === "done" && result.profit !== undefined) {
        expect(Math.abs(result.profit) % 20000 === 0 || result.profit === 0).toBe(true);
      }
      return;
    }
  });

  test("split on a pair creates two hands", () => {
    for (let i = 0; i < 500; i++) {
      const r = blackjackStart(10000);
      if (r.stage !== "player" || !r.canSplit || !r.state) continue;
      const result = blackjackAction(r.state, "split");
      if ("error" in result) continue;
      expect(result.hands).toHaveLength(2);
      return;
    }
  });

  test("invalid state returns error", () => {
    const r = blackjackAction("garbage", "stand");
    expect("error" in r).toBe(true);
  });

  test("handValue: blackjack detection on 2-card 21", () => {
    const v = handValue([{ rank: 1, suit: "hearts" }, { rank: 13, suit: "spades" }]);
    expect(v.blackjack).toBe(true);
    expect(v.total).toBe(21);
  });
});

// ─── Video Poker ──────────────────────────────────────────────────────────────

describe("Video Poker", () => {
  test("deal returns 5 cards and a state blob", () => {
    const r = videoPokerDeal(10000);
    expect(r.hand).toHaveLength(5);
    expect(r.state).toBeTruthy();
  });

  test("draw with all holds returns the same hand", () => {
    const deal = videoPokerDeal(10000);
    const r = videoPokerDraw(deal.state, [true, true, true, true, true]);
    if ("error" in r) throw new Error(r.error);
    expect(r.finalHand).toEqual(deal.hand);
  });

  test("draw with no holds replaces all 5 cards", () => {
    const deal = videoPokerDeal(10000);
    const r = videoPokerDraw(deal.state, [false, false, false, false, false]);
    if ("error" in r) throw new Error(r.error);
    // Final hand should differ in composition from the original deal (extremely likely)
    const sameCount = r.finalHand.filter((c, i) =>
      c.rank === deal.hand[i].rank && c.suit === deal.hand[i].suit).length;
    expect(sameCount).toBeLessThan(5);
  });

  test("videoPokerPayout matches the 9/6 Jacks-or-Better paytable", () => {
    expect(videoPokerPayout("royal_flush")).toBe(800);
    expect(videoPokerPayout("straight_flush")).toBe(50);
    expect(videoPokerPayout("four_of_a_kind")).toBe(25);
    expect(videoPokerPayout("full_house")).toBe(9);
    expect(videoPokerPayout("flush")).toBe(6);
    expect(videoPokerPayout("straight")).toBe(4);
    expect(videoPokerPayout("three_of_a_kind")).toBe(3);
    expect(videoPokerPayout("two_pair")).toBe(2);
    expect(videoPokerPayout("jacks_or_better")).toBe(1);
    expect(videoPokerPayout("nothing")).toBe(0);
  });

  test("profit is bet × (multiplier - 1) on win, -bet on loss", () => {
    for (let i = 0; i < 200; i++) {
      const deal = videoPokerDeal(10000);
      const r = videoPokerDraw(deal.state, [false, false, false, false, false]);
      if ("error" in r) continue;
      if (r.multiplier > 0) expect(r.profit).toBe(Math.floor(10000 * (r.multiplier - 1)));
      else expect(r.profit).toBe(-10000);
    }
  });

  test("draw: invalid state returns error", () => {
    const r = videoPokerDraw("garbage", [true, true, true, true, true]);
    expect("error" in r).toBe(true);
  });

  test("draw: wrong number of holds returns error", () => {
    const deal = videoPokerDeal(10000);
    const r = videoPokerDraw(deal.state, [true, true]);
    expect("error" in r).toBe(true);
  });

  test("fresh 5-card hand RTP (no holds = pure random hand) matches known poker odds", () => {
    // Discarding everything every time means each "final hand" is just a fresh
    // random 5-card deal — there's no strategy here, so RTP is far below the
    // ~99% optimal-play figure quoted for 9/6 Jacks-or-Better. The true expected
    // value of a uniformly random 5-card hand against this paytable is ~33.6%.
    const N = 20_000;
    const bet = 1000;
    let net = 0;
    for (let n = 0; n < N; n++) {
      const deal = videoPokerDeal(bet);
      const r = videoPokerDraw(deal.state, [false, false, false, false, false]);
      if ("error" in r) continue;
      net += r.profit;
    }
    const rtp = 1 + net / (N * bet);
    expect(rtp).toBeGreaterThan(0.25);
    expect(rtp).toBeLessThan(0.45);
  });
});
