import { verifyCommitment } from "@/engine/rng/verifier";
import type { SeedInput } from "@/engine/rng/types";
import { getGame } from "./registry";
import { replayRound, type Json, type RoundGame, type Settlement } from "./types";

export interface RecordedBet {
  game: string;
  params: Json;
  actions: Json[];
  outcome: Json;
  multiplier: number;
}

export interface VerificationReport {
  commitmentValid: boolean | null;
  expected: Settlement<unknown> | null;
  outcomeMatches: boolean;
  multiplierMatches: boolean;
  verified: boolean;
  error: string | null;
}

/** Recomputes a game's result from seeds + params (+ recorded actions for multi-step games). */
export function recompute(gameId: string, seeds: SeedInput, params: Json, actions: Json[] = []): Settlement<unknown> {
  const game = getGame(gameId);
  if (!game) throw new Error(`Unknown game "${gameId}"`);
  const engine = game.engine;
  if (engine.kind === "instant") return engine.play(seeds, params as never);
  const round = engine as unknown as RoundGame<Json, unknown, Json, unknown>;
  const state = replayRound(round, seeds, params, actions);
  if (!round.isFinished(state)) throw new Error("Recorded actions do not finish the round");
  return round.settle(state);
}

/** Canonical JSON (sorted keys) so key order never causes a false mismatch. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export function verifyBet(bet: RecordedBet, seeds: SeedInput, serverSeedHash?: string): VerificationReport {
  const commitmentValid = serverSeedHash ? verifyCommitment(seeds.serverSeed, serverSeedHash) : null;
  try {
    const expected = recompute(bet.game, seeds, bet.params, bet.actions);
    const outcomeMatches = canonical(expected.outcome) === canonical(bet.outcome);
    const multiplierMatches = Math.abs(expected.multiplier - bet.multiplier) < 1e-9;
    return {
      commitmentValid,
      expected,
      outcomeMatches,
      multiplierMatches,
      verified: outcomeMatches && multiplierMatches && commitmentValid !== false,
      error: null,
    };
  } catch (e) {
    return {
      commitmentValid,
      expected: null,
      outcomeMatches: false,
      multiplierMatches: false,
      verified: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
