import { shuffleDeck, rankPokerHand, type Card, type PokerCategory } from "./cards";
import { hashServerSeed, freshSeeds, type SeedInput } from "./rng";

/**
 * Video Poker — Jacks or Better, standard 9/6 paytable (per 1 unit bet).
 * Deal 5 cards, hold any subset, draw replacements for the rest, pay by final hand rank.
 */

const PAYTABLE: Record<PokerCategory, number> = {
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

export function videoPokerPayout(category: PokerCategory): number {
  return PAYTABLE[category];
}

export interface VideoPokerState {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  betAmount: number;
  hand: Card[];
}

// ─── Deal ─────────────────────────────────────────────────────────────────────

export interface VideoPokerDealResult {
  hand: Card[];
  state: string;
  serverSeedHash: string;
  clientSeed: string;
}

export function videoPokerDeal(betAmount: number, seeds: SeedInput = freshSeeds()): VideoPokerDealResult {
  const { serverSeed, clientSeed, nonce } = seeds;
  const deck = shuffleDeck(serverSeed, clientSeed, nonce);
  const hand = deck.slice(0, 5);

  const st: VideoPokerState = { serverSeed, clientSeed, nonce, betAmount, hand };
  return {
    hand,
    state: Buffer.from(JSON.stringify(st)).toString("base64"),
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed,
  };
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

export interface VideoPokerDrawResult {
  finalHand: Card[];
  category: PokerCategory;
  label: string;
  multiplier: number;
  profit: number;
  serverSeed: string;
}

export function videoPokerDraw(
  encodedState: string,
  holds: boolean[],
): VideoPokerDrawResult | { error: string } {
  let st: VideoPokerState;
  try { st = JSON.parse(Buffer.from(encodedState, "base64").toString()); }
  catch { return { error: "Invalid state" }; }

  if (holds.length !== 5) return { error: "Must specify 5 hold flags" };

  const deck = shuffleDeck(st.serverSeed, st.clientSeed, st.nonce);
  let drawPos = 5;
  const finalHand: Card[] = st.hand.map((card, i) => (holds[i] ? card : deck[drawPos++]));

  const rank = rankPokerHand(finalHand);
  const multiplier = videoPokerPayout(rank.category);
  const profit = multiplier > 0
    ? Math.floor(st.betAmount * (multiplier - 1))
    : -st.betAmount;

  return {
    finalHand,
    category: rank.category,
    label: rank.label,
    multiplier,
    profit,
    serverSeed: st.serverSeed,
  };
}
