import { POKER_LABELS, rankPokerHand, shuffleDeck, type Card, type PokerCategory } from "@/engine/cards/deck";
import type { RoundGame } from "../types";

/**
 * Video Poker — Jacks or Better, full-pay 9/6 table (total return per unit).
 * Deal deck[0..4], hold any cards, replacements come from deck[5..] in order.
 * Theoretical RTP with perfect strategy is 99.54% (well-known result for 9/6
 * JoB); worse holds return less. Ported from the original video-poker.ts.
 */

export const VIDEO_POKER_PAYTABLE: Record<PokerCategory, number> = {
  royal_flush: 800,
  straight_flush: 50,
  four_of_a_kind: 25,
  full_house: 9,
  flush: 6,
  straight: 4,
  three_of_a_kind: 3,
  two_pair: 2,
  jacks_or_better: 1,
  nothing: 0,
};
export const VIDEO_POKER_OPTIMAL_RTP = 0.9954;

export type VideoPokerAction = { type: "draw"; holds: boolean[] };

export interface VideoPokerState {
  deck: Card[];
  hand: Card[];
  holds: boolean[] | null;
  category: PokerCategory | null;
}

export interface VideoPokerOutcome {
  initial: Card[];
  holds: boolean[];
  final: Card[];
  category: PokerCategory;
  label: string;
}

export const videoPokerGame: RoundGame<Record<string, never>, VideoPokerState, VideoPokerAction, VideoPokerOutcome> = {
  kind: "round",
  start(seeds) {
    const deck = shuffleDeck(seeds);
    return { deck, hand: deck.slice(0, 5), holds: null, category: null };
  },
  act(state, action) {
    if (state.holds !== null || action.holds.length !== 5) return state;
    let next = 5;
    const hand = state.hand.map((card, i) => (action.holds[i] ? card : state.deck[next++]));
    return { ...state, hand, holds: [...action.holds], category: rankPokerHand(hand) };
  },
  isFinished: (s) => s.category !== null,
  stakeUnits: () => 1,
  settle(s) {
    const category = s.category ?? "nothing";
    return {
      multiplier: VIDEO_POKER_PAYTABLE[category],
      stakeUnits: 1,
      outcome: { initial: s.deck.slice(0, 5), holds: s.holds ?? [], final: s.hand, category, label: POKER_LABELS[category] },
    };
  },
};
