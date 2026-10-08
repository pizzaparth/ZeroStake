import { GAME_RTP } from "@/config/rtp";
import { createFloatStream } from "@/engine/rng/byteGenerator";
import { survivalProbability } from "@/engine/probability/combinatorics";
import { fisherYatesShuffle } from "@/engine/probability/distributions";
import { floorTo } from "@/engine/probability/houseEdge";
import type { RoundGame } from "../types";

/**
 * Mines — 5×5 grid with M hidden mines. Reveal safe tiles to grow the
 * multiplier; hit a mine and the stake is lost.
 *
 * Layout: full Fisher–Yates shuffle of tiles 0–24 using cursor s for step s;
 * the first M shuffled tiles are mines (same cursor layout as the original).
 *
 * After k safe reveals:
 *   P(survive k) = C(25 − M, k) / C(25, k)
 *   multiplier(k) = floor₂(RTP / P(survive k))
 */

export const MINES_GRID = 25;
export const MINES_RTP = GAME_RTP.mines;

export interface MinesParams {
  mineCount: number;
}

export type MinesAction = { type: "reveal"; tile: number } | { type: "cashout" };

export interface MinesState {
  mineCount: number;
  mines: number[];
  revealed: number[];
  hitMine: number | null;
  status: "playing" | "busted" | "cashed";
}

export interface MinesOutcome {
  mineCount: number;
  mines: number[];
  revealed: number[];
  hitMine: number | null;
}

export function minesProbability(mineCount: number, safeRevealed: number): number {
  return survivalProbability(MINES_GRID, mineCount, safeRevealed);
}

export function minesMultiplier(mineCount: number, safeRevealed: number, rtp = MINES_RTP): number {
  if (safeRevealed === 0) return 1;
  return floorTo(rtp / minesProbability(mineCount, safeRevealed), 2);
}

export function generateMines(seeds: Parameters<typeof createFloatStream>[0], mineCount: number): number[] {
  const stream = createFloatStream(seeds);
  return fisherYatesShuffle(MINES_GRID, stream.at).slice(0, mineCount);
}

export const minesGame: RoundGame<MinesParams, MinesState, MinesAction, MinesOutcome> = {
  kind: "round",
  start(seeds, { mineCount }) {
    if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > MINES_GRID - 1) throw new Error("Invalid mine count");
    return { mineCount, mines: generateMines(seeds, mineCount), revealed: [], hitMine: null, status: "playing" };
  },
  act(state, action) {
    if (state.status !== "playing") return state;
    if (action.type === "cashout") {
      return state.revealed.length > 0 ? { ...state, status: "cashed" } : state;
    }
    const { tile } = action;
    if (!Number.isInteger(tile) || tile < 0 || tile >= MINES_GRID || state.revealed.includes(tile)) return state;
    if (state.mines.includes(tile)) return { ...state, hitMine: tile, status: "busted" };
    const revealed = [...state.revealed, tile];
    // Every safe tile found: nothing left to risk, so cash out automatically.
    const status = revealed.length === MINES_GRID - state.mineCount ? "cashed" : "playing";
    return { ...state, revealed, status };
  },
  isFinished: (s) => s.status !== "playing",
  stakeUnits: () => 1,
  settle(s) {
    return {
      multiplier: s.status === "cashed" ? minesMultiplier(s.mineCount, s.revealed.length) : 0,
      stakeUnits: 1,
      outcome: { mineCount: s.mineCount, mines: s.mines, revealed: s.revealed, hitMine: s.hitMine },
    };
  },
};
