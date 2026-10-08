import { createFloatStream } from "../rng/byteGenerator";
import type { SeedInput } from "../rng/types";
import { fisherYatesShuffle } from "../probability/distributions";

/**
 * Shared 52-card primitives (ported from the original cards.ts).
 * A deck is shuffled with a full Fisher–Yates using cursor s for step s, so
 * the whole deck is reproducible from (serverSeed, clientSeed, nonce).
 */

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export interface Card {
  /** 1 = Ace, 11 = Jack, 12 = Queen, 13 = King. */
  rank: number;
  suit: Suit;
}

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const DECK_SIZE = 52;

export function cardFromId(id: number): Card {
  return { suit: SUITS[Math.floor(id / 13)], rank: (id % 13) + 1 };
}

/** Deck top-first: index 0 is the first card dealt. */
export function shuffleDeck(seeds: SeedInput): Card[] {
  const stream = createFloatStream(seeds);
  return fisherYatesShuffle(DECK_SIZE, stream.at).map(cardFromId);
}

const RANK_LABELS: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const SUIT_SYMBOLS: Record<Suit, string> = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

export const rankLabel = (rank: number) => RANK_LABELS[rank] ?? String(rank);
export const suitSymbol = (suit: Suit) => SUIT_SYMBOLS[suit];
export const isRedSuit = (suit: Suit) => suit === "hearts" || suit === "diamonds";
export const cardLabel = (c: Card) => `${rankLabel(c.rank)}${suitSymbol(c.suit)}`;

// ─── Blackjack ───────────────────────────────────────────────────────────────

export interface HandValue {
  total: number;
  soft: boolean;
  blackjack: boolean;
}

/** Aces count 11 until that would bust, then 1. */
export function handValue(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 1) {
      aces++;
      total += 11;
    } else total += Math.min(c.rank, 10);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0, blackjack: cards.length === 2 && total === 21 };
}

// ─── Poker (Jacks or Better) ─────────────────────────────────────────────────

export type PokerCategory =
  | "royal_flush"
  | "straight_flush"
  | "four_of_a_kind"
  | "full_house"
  | "flush"
  | "straight"
  | "three_of_a_kind"
  | "two_pair"
  | "jacks_or_better"
  | "nothing";

export const POKER_LABELS: Record<PokerCategory, string> = {
  royal_flush: "Royal Flush",
  straight_flush: "Straight Flush",
  four_of_a_kind: "Four of a Kind",
  full_house: "Full House",
  flush: "Flush",
  straight: "Straight",
  three_of_a_kind: "Three of a Kind",
  two_pair: "Two Pair",
  jacks_or_better: "Jacks or Better",
  nothing: "No Win",
};

export function rankPokerHand(cards: Card[]): PokerCategory {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);

  let straight = false;
  let royal = false;
  if (counts.size === 5) {
    if (ranks[4] - ranks[0] === 4) straight = true;
    // Ace-high: A,10,J,Q,K sorts as [1,10,11,12,13].
    if (ranks.join() === "1,10,11,12,13") straight = royal = true;
  }

  if (straight && flush) return royal ? "royal_flush" : "straight_flush";
  if (groups[0] === 4) return "four_of_a_kind";
  if (groups[0] === 3 && groups[1] === 2) return "full_house";
  if (flush) return "flush";
  if (straight) return "straight";
  if (groups[0] === 3) return "three_of_a_kind";
  if (groups[0] === 2 && groups[1] === 2) return "two_pair";
  if (groups[0] === 2) {
    const pair = [...counts.entries()].find(([, n]) => n === 2)![0];
    return pair === 1 || pair >= 11 ? "jacks_or_better" : "nothing";
  }
  return "nothing";
}
