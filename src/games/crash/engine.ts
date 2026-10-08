import { GAME_RTP } from "@/config/rtp";
import { createFloatStream } from "@/engine/rng/byteGenerator";
import { floorTo } from "@/engine/probability/houseEdge";
import type { RoundGame } from "../types";

/**
 * Crash — the crash point is fixed from the seeds BEFORE the round starts;
 * the rising curve is only a visualisation of time.
 *
 *   u = float(cursor 0)
 *   crashPoint = u < 1 − RTP ? 1.00 : floor₂(RTP / (1 − u))
 *
 * For any cash-out m ≥ 1.01: P(crashPoint ≥ m) = RTP / m, so every strategy
 * returns RTP. (Ported from the original crash.ts.)
 */

export const CRASH_RTP = GAME_RTP.crash;
export const CRASH_MAX = 1_000_000;
/**
 * Growth rate of the displayed curve: m(t) = e^(k·t), t in ms. Visual only —
 * the crash point is fixed before the curve starts. 2× is reached in ~4.3 s
 * (the original 0.00006 took ~11.5 s).
 */
export const CRASH_GROWTH = 0.00016;

export function crashPointFromFloat(u: number, rtp = CRASH_RTP): number {
  if (u < 1 - rtp) return 1;
  return Math.min(CRASH_MAX, Math.max(1, floorTo(rtp / (1 - u), 2)));
}

export function crashMultiplierAt(elapsedMs: number): number {
  return floorTo(Math.exp(CRASH_GROWTH * elapsedMs), 2);
}

export function crashTimeFor(multiplier: number): number {
  return Math.log(multiplier) / CRASH_GROWTH;
}

export interface CrashParams {
  /** Optional automatic cash-out target (≥ 1.01). */
  autoCashout: number | null;
}

export type CrashAction = { type: "cashout"; at: number } | { type: "bust" };

export interface CrashState {
  crashPoint: number;
  autoCashout: number | null;
  cashedOutAt: number | null;
  status: "running" | "cashed" | "busted";
}

export interface CrashOutcome {
  crashPoint: number;
  autoCashout: number | null;
  cashedOutAt: number | null;
}

export const crashGame: RoundGame<CrashParams, CrashState, CrashAction, CrashOutcome> = {
  kind: "round",
  start(seeds, { autoCashout }) {
    if (autoCashout !== null && !(autoCashout >= 1.01)) throw new Error("Invalid auto cash-out");
    return {
      crashPoint: crashPointFromFloat(createFloatStream(seeds).next()),
      autoCashout,
      cashedOutAt: null,
      status: "running",
    };
  },
  act(state, action) {
    if (state.status !== "running") return state;
    if (action.type === "bust") return { ...state, status: "busted" };
    const at = floorTo(action.at, 2);
    // A cash-out the curve never reached is impossible, so it counts as a bust.
    if (at < 1 || at > state.crashPoint) return { ...state, status: "busted" };
    return { ...state, cashedOutAt: at, status: "cashed" };
  },
  isFinished: (s) => s.status !== "running",
  stakeUnits: () => 1,
  settle(s) {
    return {
      multiplier: s.status === "cashed" && s.cashedOutAt !== null ? s.cashedOutAt : 0,
      stakeUnits: 1,
      outcome: { crashPoint: s.crashPoint, autoCashout: s.autoCashout, cashedOutAt: s.cashedOutAt },
    };
  },
};

/**
 * Settles a round the app was closed during. Auto cash-out still applies if
 * the crash point reached it; otherwise the bet is lost (no manual cash-out happened).
 */
export function resolveAbandonedCrash(state: CrashState): CrashAction {
  if (state.autoCashout !== null && state.autoCashout <= state.crashPoint) {
    return { type: "cashout", at: state.autoCashout };
  }
  return { type: "bust" };
}
