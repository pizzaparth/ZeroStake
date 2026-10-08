import { generateOutcome } from "./rng";

/**
 * Shared 52-card primitives for card games (Hilo, Blackjack, Video Poker, Baccarat).
 *
 * Cards are shuffled with the same Fisher-Yates technique as
 * `generateMinePositions` in mines.ts: each swap consumes one fresh HMAC outcome
 * at the next cursor under a single nonce, so the whole deck is reproducible
 * from the seeds.
 */

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export interface Card {
  rank: number; // 1 = Ace, 11 = Jack, 12 = Queen, 13 = King
  suit: Suit;
}

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const DECK_SIZE = 52;

/** Map a deck index 0–51 to a Card. */
export function cardFromId(id: number): Card {
  return { suit: SUITS[Math.floor(id / 13)], rank: (id % 13) + 1 };
}

const RANK_LABELS: Record<number, string> = {
  1: "A", 11: "J", 12: "Q", 13: "K",
};
const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠",
};

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank);
}
export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}
export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

/**
 * Provably-fair shuffle of a full 52-card deck.
 * Returns the deck top-first (index 0 is the first card dealt).
 */
export function shuffleDeck(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Card[] {
  const ids = Array.from({ length: DECK_SIZE }, (_, i) => i);
  for (let i = DECK_SIZE - 1; i > 0; i--) {
    const outcome = generateOutcome(serverSeed, clientSeed, nonce, DECK_SIZE - 1 - i);
    const j = Math.floor(outcome * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.map(cardFromId);
}

// ─── Blackjack hand value ─────────────────────────────────────────────────────

export interface HandValue {
  total: number;
  soft: boolean;   // true if an ace is still counted as 11
  blackjack: boolean;
}

/** Blackjack value of a hand. Aces count as 11 until that would bust, then 1. */
export function handValue(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 1) { aces++; total += 11; }
    else total += Math.min(c.rank, 10); // J/Q/K = 10
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) { total -= 10; aces--; soft = aces > 0 ? soft : false; }
  if (aces === 0) soft = false;
  const blackjack = cards.length === 2 && total === 21;
  return { total, soft, blackjack };
}

// ─── Baccarat point value ─────────────────────────────────────────────────────

/** Baccarat point total: pip values, face/ten = 0, modulo 10. */
export function baccaratPoints(cards: Card[]): number {
  const sum = cards.reduce((acc, c) => acc + (c.rank >= 10 ? 0 : c.rank), 0);
  return sum % 10;
}

// ─── Poker hand ranking (Jacks or Better) ─────────────────────────────────────

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

export interface PokerHand {
  category: PokerCategory;
  label: string;
}

const POKER_LABELS: Record<PokerCategory, string> = {
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

/** Evaluate a 5-card poker hand using Jacks-or-Better rules. */
export function rankPokerHand(cards: Card[]): PokerHand {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const flush = cards.every((c) => c.suit === cards[0].suit);

  // Counts per rank
  const counts: Record<number, number> = {};
  for (const r of ranks) counts[r] = (counts[r] ?? 0) + 1;
  const groups = Object.values(counts).sort((a, b) => b - a); // e.g. [3,2] = full house

  // Straight detection — Ace can be high (10-J-Q-K-A) or low (A-2-3-4-5).
  const unique = [...new Set(ranks)];
  let straight = false;
  let straightHigh = 0;
  if (unique.length === 5) {
    if (ranks[4] - ranks[0] === 4) { straight = true; straightHigh = ranks[4]; }
    // Wheel: A,2,3,4,5 → ranks sorted [1,2,3,4,5]
    if (ranks[0] === 1 && ranks[1] === 2 && ranks[2] === 3 && ranks[3] === 4 && ranks[4] === 5) {
      straight = true; straightHigh = 5;
    }
    // Royal-high straight: 10,J,Q,K,A → [1,10,11,12,13]
    if (ranks[0] === 1 && ranks[1] === 10 && ranks[2] === 11 && ranks[3] === 12 && ranks[4] === 13) {
      straight = true; straightHigh = 14;
    }
  }

  let category: PokerCategory;
  if (straight && flush && straightHigh === 14) category = "royal_flush";
  else if (straight && flush) category = "straight_flush";
  else if (groups[0] === 4) category = "four_of_a_kind";
  else if (groups[0] === 3 && groups[1] === 2) category = "full_house";
  else if (flush) category = "flush";
  else if (straight) category = "straight";
  else if (groups[0] === 3) category = "three_of_a_kind";
  else if (groups[0] === 2 && groups[1] === 2) category = "two_pair";
  else if (groups[0] === 2) {
    // Only pays if the pair is Jacks or better (J/Q/K/A)
    const pairRank = Number(Object.keys(counts).find((r) => counts[Number(r)] === 2));
    const high = pairRank === 1 || pairRank >= 11;
    category = high ? "jacks_or_better" : "nothing";
  } else category = "nothing";

  return { category, label: POKER_LABELS[category] };
}
