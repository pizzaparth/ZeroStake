import type { SeedInput } from "@/engine/rng/types";

export type GameId =
  "dice" | "limbo" | "mines" | "dragonTower" | "wheel" | "flip" | "keno" | "plinko" | "hilo" | "crash" | "blackjack" | "videoPoker" | "diamonds";

/** Plain JSON values only: params, actions and outcomes are stored in SQLite as JSON. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Result of a finished bet, expressed relative to the base stake. */
export interface Settlement<O> {
  /** Total return ÷ base stake (0 = lost everything, 1 = stake back). */
  multiplier: number;
  /** Total staked ÷ base stake (1 except Blackjack doubles/splits). */
  stakeUnits: number;
  /** Everything needed to show and verify what happened, including revealed secrets. */
  outcome: O;
}

/** One-shot games: the whole result comes from a single call. */
export interface InstantGame<P, O> {
  kind: "instant";
  play(seeds: SeedInput, params: P): Settlement<O>;
}

/** Multi-step games: a hidden state advanced by player actions until finished. */
export interface RoundGame<P, S, A, O> {
  kind: "round";
  start(seeds: SeedInput, params: P): S;
  act(state: S, action: A): S;
  isFinished(state: S): boolean;
  /** Valid once finished. */
  settle(state: S): Settlement<O>;
  /** Total stake units committed so far (lets the wallet charge Blackjack doubles/splits). */
  stakeUnits(state: S): number;
}

export type AnyGameEngine = InstantGame<never, unknown> | RoundGame<never, unknown, unknown, unknown>;

/** Replays a round game from its seeds and recorded actions. */
export function replayRound<P, S, A, O>(game: RoundGame<P, S, A, O>, seeds: SeedInput, params: P, actions: A[]): S {
  return actions.reduce((state, action) => game.act(state, action), game.start(seeds, params));
}
