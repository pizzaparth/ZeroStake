import { handValue, shuffleDeck, type Card } from "@/engine/cards/deck";
import type { RoundGame } from "../types";

/**
 * Blackjack (ported from the original blackjack.ts):
 * - one freshly shuffled 52-card deck per round (provably fair shuffle)
 * - deal order: player, dealer, player, dealer
 * - dealer peeks: a natural on either side ends the round immediately
 * - dealer HITS soft 17 (H17). The original stood on soft 17, which with these
 *   single-deck rules gave the player a ~0.2% edge under basic strategy
 *   (3M-round simulation: 100.21% RTP). H17 brings it back under 100%.
 * - double on any first two cards (also after a split)
 * - one split (no resplit); blackjack pays 3:2; equal totals push
 *
 * Amounts are in "units" of the base stake so the engine stays currency-free.
 */

export type BlackjackAction = { type: "hit" } | { type: "stand" } | { type: "double" } | { type: "split" };
export type HandResult = "blackjack" | "win" | "push" | "lose" | "bust";

export interface BlackjackHand {
  cards: Card[];
  units: number;
  finished: boolean;
  busted: boolean;
  doubled: boolean;
}

export interface BlackjackState {
  deck: Card[];
  position: number;
  hands: BlackjackHand[];
  current: number;
  dealer: Card[];
  status: "player" | "done";
  results: HandResult[];
}

export interface BlackjackOutcome {
  hands: { cards: Card[]; units: number; result: HandResult }[];
  dealer: Card[];
}

export function canDouble(s: BlackjackState): boolean {
  const hand = s.hands[s.current];
  return s.status === "player" && !!hand && hand.cards.length === 2;
}

export function canSplit(s: BlackjackState): boolean {
  const hand = s.hands[s.current];
  return s.status === "player" && s.hands.length === 1 && hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank;
}

/** Extra stake units an action needs (the wallet must charge these first). */
export function extraUnitsFor(s: BlackjackState, action: BlackjackAction): number {
  if (action.type === "double" && canDouble(s)) return s.hands[s.current].units;
  if (action.type === "split" && canSplit(s)) return s.hands[s.current].units;
  return 0;
}

function settleHand(hand: BlackjackHand, dealer: Card[]): HandResult {
  if (hand.busted) return "bust";
  const d = handValue(dealer).total;
  const p = handValue(hand.cards).total;
  if (d > 21 || p > d) return "win";
  if (p === d) return "push";
  return "lose";
}

const RETURN_FACTOR: Record<HandResult, number> = { blackjack: 2.5, win: 2, push: 1, lose: 0, bust: 0 };

function finishRound(s: BlackjackState): BlackjackState {
  const dealer = [...s.dealer];
  let position = s.position;
  if (!s.hands.every((h) => h.busted)) {
    for (let v = handValue(dealer); v.total < 17 || (v.total === 17 && v.soft); v = handValue(dealer)) {
      dealer.push(s.deck[position++]);
    }
  }
  return { ...s, dealer, position, status: "done", results: s.hands.map((h) => settleHand(h, dealer)) };
}

function advance(s: BlackjackState): BlackjackState {
  let current = s.current;
  while (current < s.hands.length && s.hands[current].finished) current++;
  const next = { ...s, current };
  return current >= s.hands.length ? finishRound(next) : next;
}

export const blackjackGame: RoundGame<Record<string, never>, BlackjackState, BlackjackAction, BlackjackOutcome> = {
  kind: "round",
  start(seeds) {
    const deck = shuffleDeck(seeds);
    const player = [deck[0], deck[2]];
    const dealer = [deck[1], deck[3]];
    const hand: BlackjackHand = { cards: player, units: 1, finished: false, busted: false, doubled: false };
    const base: BlackjackState = { deck, position: 4, hands: [hand], current: 0, dealer, status: "player", results: [] };

    const playerBJ = handValue(player).blackjack;
    const dealerBJ = handValue(dealer).blackjack;
    if (playerBJ || dealerBJ) {
      const result: HandResult = playerBJ && dealerBJ ? "push" : playerBJ ? "blackjack" : "lose";
      return { ...base, hands: [{ ...hand, finished: true }], status: "done", results: [result] };
    }
    return base;
  },
  act(state, action) {
    if (state.status !== "player") return state;
    const hands = state.hands.map((h) => ({ ...h, cards: [...h.cards] }));
    const hand = hands[state.current];
    let position = state.position;
    const draw = () => state.deck[position++];

    switch (action.type) {
      case "hit": {
        hand.cards.push(draw());
        const total = handValue(hand.cards).total;
        if (total > 21) hand.busted = hand.finished = true;
        else if (total === 21) hand.finished = true;
        break;
      }
      case "stand":
        hand.finished = true;
        break;
      case "double": {
        if (!canDouble(state)) return state;
        hand.doubled = true;
        hand.units *= 2;
        hand.cards.push(draw());
        hand.busted = handValue(hand.cards).total > 21;
        hand.finished = true;
        break;
      }
      case "split": {
        if (!canSplit(state)) return state;
        const second: BlackjackHand = { cards: [hand.cards[1]], units: hand.units, finished: false, busted: false, doubled: false };
        hand.cards = [hand.cards[0], draw()];
        second.cards.push(draw());
        hands.splice(state.current + 1, 0, second);
        break;
      }
    }
    return advance({ ...state, hands, position });
  },
  isFinished: (s) => s.status === "done",
  stakeUnits: (s) => s.hands.reduce((sum, h) => sum + h.units, 0),
  settle(s) {
    const hands = s.hands.map((h, i) => ({ cards: h.cards, units: h.units, result: s.results[i] }));
    const multiplier = hands.reduce((sum, h) => sum + h.units * RETURN_FACTOR[h.result], 0);
    return { multiplier, stakeUnits: blackjackGame.stakeUnits(s), outcome: { hands, dealer: s.dealer } };
  },
};
