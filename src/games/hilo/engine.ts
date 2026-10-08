import { GAME_RTP } from "@/config/rtp";
import { DECK_SIZE, shuffleDeck, type Card } from "@/engine/cards/deck";
import { floorTo } from "@/engine/probability/houseEdge";
import type { RoundGame } from "../types";

/**
 * Hilo — one provably-fair shuffled deck per round. The first card is shown;
 * guess whether the next is strictly higher or lower (equal rank loses).
 *
 * Odds are exact for the cards still in the deck:
 *   P(higher) = #remaining cards with rank > current / #remaining cards
 * The original priced every guess as if 51 cards remained, which a player
 * tracking seen cards could exploit. With exact odds every guess is priced at
 * its true probability, so:
 *   multiplier = floor₂(RTP / Π P(each correct guess))
 * returns the configured RTP at any cash-out point. Skipping a card is free:
 * it reveals the card without a bet.
 */

export const HILO_RTP = GAME_RTP.hilo;

export type HiloGuess = "higher" | "lower";
export type HiloAction = { type: "guess"; guess: HiloGuess } | { type: "skip" } | { type: "cashout" };

export interface HiloStep {
  card: Card;
  /** How the player moved past the previous card to reach this one. */
  via: HiloGuess | "skip" | "start";
  correct: boolean;
}

export interface HiloState {
  deck: Card[];
  position: number;
  probability: number;
  correctGuesses: number;
  steps: HiloStep[];
  status: "playing" | "busted" | "cashed";
}

export interface HiloOutcome {
  steps: HiloStep[];
  multiplier: number;
}

export interface HiloOdds {
  higher: number;
  lower: number;
}

/** Exact odds for the next card given everything already dealt. */
export function hiloOdds(state: Pick<HiloState, "deck" | "position">): HiloOdds {
  const current = state.deck[state.position].rank;
  const remaining = state.deck.slice(state.position + 1);
  if (remaining.length === 0) return { higher: 0, lower: 0 };
  const higher = remaining.filter((c) => c.rank > current).length;
  const lower = remaining.filter((c) => c.rank < current).length;
  return { higher: higher / remaining.length, lower: lower / remaining.length };
}

export function hiloMultiplierFor(probability: number, rtp = HILO_RTP): number {
  return probability >= 1 ? 1 : floorTo(rtp / probability, 2);
}

export function hiloCurrentMultiplier(state: HiloState): number {
  return state.correctGuesses === 0 ? 1 : hiloMultiplierFor(state.probability);
}

/** Multiplier the player would hold after a correct guess (0 if the guess can't win). */
export function hiloNextMultiplier(state: HiloState, guess: HiloGuess): number {
  const p = hiloOdds(state)[guess];
  return p > 0 ? hiloMultiplierFor(state.probability * p) : 0;
}

export function hiloCanSkip(state: HiloState): boolean {
  // Keep at least two cards so a guess is still possible after skipping.
  return state.status === "playing" && state.position < DECK_SIZE - 2;
}

export const hiloGame: RoundGame<Record<string, never>, HiloState, HiloAction, HiloOutcome> = {
  kind: "round",
  start(seeds) {
    const deck = shuffleDeck(seeds);
    return {
      deck,
      position: 0,
      probability: 1,
      correctGuesses: 0,
      steps: [{ card: deck[0], via: "start", correct: true }],
      status: "playing",
    };
  },
  act(state, action) {
    if (state.status !== "playing") return state;
    if (action.type === "cashout") return state.correctGuesses > 0 ? { ...state, status: "cashed" } : state;
    if (state.position >= DECK_SIZE - 1) return state;

    const next = state.deck[state.position + 1];
    if (action.type === "skip") {
      if (!hiloCanSkip(state)) return state;
      return { ...state, position: state.position + 1, steps: [...state.steps, { card: next, via: "skip", correct: true }] };
    }

    const p = hiloOdds(state)[action.guess];
    if (p === 0) return state; // impossible guess: UI disables it
    const current = state.deck[state.position].rank;
    const correct = action.guess === "higher" ? next.rank > current : next.rank < current;
    const steps = [...state.steps, { card: next, via: action.guess, correct }];
    if (!correct) return { ...state, position: state.position + 1, steps, status: "busted" };
    const moved: HiloState = {
      ...state,
      position: state.position + 1,
      probability: state.probability * p,
      correctGuesses: state.correctGuesses + 1,
      steps,
    };
    // Last card of the deck: nothing left to guess, so cash out.
    return moved.position >= DECK_SIZE - 1 ? { ...moved, status: "cashed" } : moved;
  },
  isFinished: (s) => s.status !== "playing",
  stakeUnits: () => 1,
  settle(s) {
    const multiplier = s.status === "cashed" ? hiloCurrentMultiplier(s) : 0;
    return { multiplier, stakeUnits: 1, outcome: { steps: s.steps, multiplier } };
  },
};
