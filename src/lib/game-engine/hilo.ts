import { shuffleDeck, type Card } from "./cards";
import { hashServerSeed, freshSeeds, type SeedInput } from "./rng";

/**
 * Hilo — guess whether each next card is higher or lower than the current one.
 *
 * A full 52-card deck is shuffled provably-fairly at game start. The first card
 * is revealed. Each round, the player guesses Higher or Lower; if correct the
 * multiplier compounds and the next card becomes current. Cashout any time.
 *
 * Multiplier step formula (1% edge):
 *   step = floor(0.99 / P(win) × 100) / 100
 *   P(higher) = cards strictly higher than current rank / 51 remaining
 *   P(lower)  = cards strictly lower  than current rank / 51 remaining
 *
 * If the guess is impossible (e.g. Higher on King) the step is 0 — the client
 * should disable that button. Ties (same rank) count as a loss.
 */

export type HiloGuess = "higher" | "lower";

export interface HiloState {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  betAmount: number;
  position: number;   // current card index in the shuffled deck (0 = first card)
  multiplier: number; // accumulated payout multiplier so far
}

// How many of the other 51 cards are strictly higher / lower than rank R
export function hiloOdds(rank: number): { higher: number; lower: number } {
  return {
    higher: (13 - rank) * 4,
    lower: (rank - 1) * 4,
  };
}

// Step multiplier for a single correct guess (1% edge); 0 if the guess is impossible
export function hiloStep(rank: number, guess: HiloGuess): number {
  const { higher, lower } = hiloOdds(rank);
  const count = guess === "higher" ? higher : lower;
  if (count === 0) return 0;
  return Math.floor((0.99 / (count / 51)) * 100) / 100;
}

// ─── Start ────────────────────────────────────────────────────────────────────

export interface HiloStartResult {
  card: Card;
  state: string;
  serverSeedHash: string;
  clientSeed: string;
}

export function hiloStart(betAmount: number, seeds: SeedInput = freshSeeds()): HiloStartResult {
  const { serverSeed, clientSeed, nonce } = seeds;

  const deck = shuffleDeck(serverSeed, clientSeed, nonce);
  const card = deck[0];

  const state: HiloState = { serverSeed, clientSeed, nonce, betAmount, position: 0, multiplier: 1 };
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64");

  return { card, state: encoded, serverSeedHash: hashServerSeed(serverSeed), clientSeed };
}

// ─── Guess ────────────────────────────────────────────────────────────────────

export interface HiloGuessResult {
  correct: boolean;
  prevCard: Card;
  nextCard: Card;
  multiplier: number;   // new accumulated multiplier (0 if bust)
  currentProfit: number; // bet * (multiplier - 1) — for cashout preview
  profit: number;        // only meaningful if !correct (= −betAmount)
  state: string | null;  // updated state blob (null if game over)
  serverSeed: string | null; // revealed on game over
}

export function hiloGuess(
  encodedState: string,
  guess: HiloGuess,
): HiloGuessResult | { error: string } {
  let st: HiloState;
  try { st = JSON.parse(Buffer.from(encodedState, "base64").toString()); }
  catch { return { error: "Invalid state" }; }

  const deck = shuffleDeck(st.serverSeed, st.clientSeed, st.nonce);
  const prevCard = deck[st.position];
  const nextCard = deck[st.position + 1];

  if (!nextCard) return { error: "Deck exhausted" };

  const isHigher = nextCard.rank > prevCard.rank;
  const isLower  = nextCard.rank < prevCard.rank;
  const correct  = (guess === "higher" && isHigher) || (guess === "lower" && isLower);

  if (!correct) {
    return {
      correct: false,
      prevCard,
      nextCard,
      multiplier: 0,
      currentProfit: 0,
      profit: -st.betAmount,
      state: null,
      serverSeed: st.serverSeed,
    };
  }

  const step = hiloStep(prevCard.rank, guess);
  const newMultiplier = Math.floor(st.multiplier * step * 100) / 100;
  const newState: HiloState = { ...st, position: st.position + 1, multiplier: newMultiplier };
  const encoded = Buffer.from(JSON.stringify(newState)).toString("base64");

  return {
    correct: true,
    prevCard,
    nextCard,
    multiplier: newMultiplier,
    currentProfit: Math.floor(st.betAmount * (newMultiplier - 1)),
    profit: 0,
    state: encoded,
    serverSeed: null,
  };
}

// ─── Cashout ──────────────────────────────────────────────────────────────────

export interface HiloCashoutResult {
  multiplier: number;
  profit: number;
  serverSeed: string;
}

export function hiloCashout(encodedState: string): HiloCashoutResult | { error: string } {
  let st: HiloState;
  try { st = JSON.parse(Buffer.from(encodedState, "base64").toString()); }
  catch { return { error: "Invalid state" }; }

  if (st.multiplier <= 1) return { error: "Nothing to cashout" };

  return {
    multiplier: st.multiplier,
    profit: Math.floor(st.betAmount * (st.multiplier - 1)),
    serverSeed: st.serverSeed,
  };
}
