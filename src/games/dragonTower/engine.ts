import { GAME_RTP } from "@/config/rtp";
import { createFloatStream } from "@/engine/rng/byteGenerator";
import { sampleWithoutReplacement } from "@/engine/probability/distributions";
import { floorTo } from "@/engine/probability/houseEdge";
import type { SeedInput } from "@/engine/rng/types";
import type { RoundGame } from "../types";

/**
 * Dragon Tower — climb 9 rows. Each row has `cols` tiles, `dragons` of them
 * traps. Pick one tile per row; cash out any time.
 *
 * Row r's dragon columns: partial Fisher–Yates over the columns using cursor
 * r × 4 + d for the d-th dragon (original layout; 4 = max columns).
 *
 * p = (cols − dragons) / cols per row, rows independent:
 *   P(clear k rows) = p^k
 *   multiplier(k) = floor₂(RTP / p^k)
 *
 * The original compounded a 1% edge on every row (RTP 0.99^k); the edge is now
 * applied once, so every cash-out point returns the configured RTP.
 */

export type DragonTowerDifficulty = "easy" | "medium" | "hard" | "expert" | "master";

export const DRAGON_TOWER_ROWS = 9;
const MAX_COLS = 4;
export const DRAGON_TOWER_RTP = GAME_RTP.dragonTower;

export const DRAGON_TOWER_DIFFICULTIES: Record<DragonTowerDifficulty, { cols: number; dragons: number }> = {
  easy: { cols: 4, dragons: 1 },
  medium: { cols: 3, dragons: 1 },
  hard: { cols: 2, dragons: 1 },
  expert: { cols: 3, dragons: 2 },
  master: { cols: 4, dragons: 3 },
};

export function dragonTowerSafeChance(difficulty: DragonTowerDifficulty): number {
  const { cols, dragons } = DRAGON_TOWER_DIFFICULTIES[difficulty];
  return (cols - dragons) / cols;
}

export function dragonTowerMultiplier(difficulty: DragonTowerDifficulty, rowsCleared: number, rtp = DRAGON_TOWER_RTP): number {
  if (rowsCleared === 0) return 1;
  return floorTo(rtp / dragonTowerSafeChance(difficulty) ** rowsCleared, 2);
}

export function generateDragons(seeds: SeedInput, difficulty: DragonTowerDifficulty): number[][] {
  const { cols, dragons } = DRAGON_TOWER_DIFFICULTIES[difficulty];
  const stream = createFloatStream(seeds);
  return Array.from({ length: DRAGON_TOWER_ROWS }, (_, row) => sampleWithoutReplacement(cols, dragons, (d) => stream.at(row * MAX_COLS + d)));
}

export interface DragonTowerParams {
  difficulty: DragonTowerDifficulty;
}

export type DragonTowerAction = { type: "pick"; col: number } | { type: "cashout" };

export interface DragonTowerState {
  difficulty: DragonTowerDifficulty;
  dragons: number[][];
  picks: number[];
  status: "playing" | "busted" | "cashed";
}

export interface DragonTowerOutcome {
  difficulty: DragonTowerDifficulty;
  dragons: number[][];
  picks: number[];
}

/** Rows cleared safely (a busting pick is in `picks` but not cleared). */
export function rowsCleared(s: DragonTowerState): number {
  return s.status === "busted" ? s.picks.length - 1 : s.picks.length;
}

export const dragonTowerGame: RoundGame<DragonTowerParams, DragonTowerState, DragonTowerAction, DragonTowerOutcome> = {
  kind: "round",
  start(seeds, { difficulty }) {
    if (!(difficulty in DRAGON_TOWER_DIFFICULTIES)) throw new Error("Invalid difficulty");
    return { difficulty, dragons: generateDragons(seeds, difficulty), picks: [], status: "playing" };
  },
  act(state, action) {
    if (state.status !== "playing") return state;
    if (action.type === "cashout") return state.picks.length > 0 ? { ...state, status: "cashed" } : state;
    const { cols } = DRAGON_TOWER_DIFFICULTIES[state.difficulty];
    if (!Number.isInteger(action.col) || action.col < 0 || action.col >= cols) return state;
    const row = state.picks.length;
    const picks = [...state.picks, action.col];
    if (state.dragons[row].includes(action.col)) return { ...state, picks, status: "busted" };
    return { ...state, picks, status: picks.length === DRAGON_TOWER_ROWS ? "cashed" : "playing" };
  },
  isFinished: (s) => s.status !== "playing",
  stakeUnits: () => 1,
  settle(s) {
    return {
      multiplier: s.status === "cashed" ? dragonTowerMultiplier(s.difficulty, s.picks.length) : 0,
      stakeUnits: 1,
      outcome: { difficulty: s.difficulty, dragons: s.dragons, picks: s.picks },
    };
  },
};
