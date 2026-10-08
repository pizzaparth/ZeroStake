import { generateOutcome } from "./rng";
import { hashServerSeed, freshSeeds, type SeedInput } from "./rng";

/**
 * Dragon Tower — climb a 9-row grid. Each row has `cols` tiles; `dragons` of them
 * hide a dragon (trap). Pick any tile per row: safe → advance and compound your
 * multiplier; dragon → bust and lose your bet. Cashout anytime.
 *
 * Difficulty sets the grid shape:
 *   easy:   4 cols, 1 dragon  → P(safe) = 3/4, step ≈ 1.32×
 *   medium: 3 cols, 1 dragon  → P(safe) = 2/3, step ≈ 1.485×
 *   hard:   2 cols, 1 dragon  → P(safe) = 1/2, step ≈ 1.98×
 *   expert: 3 cols, 2 dragons → P(safe) = 1/3, step ≈ 2.97×
 *
 * Dragon positions per row are placed via partial Fisher-Yates shuffle.
 * cursor = row * MAX_COLS + i for the i-th dragon in that row.
 */

export type DragonTowerDifficulty = "easy" | "medium" | "hard" | "expert";

const ROWS = 9;
const MAX_COLS = 4;

const DIFFICULTY_CONFIG: Record<
  DragonTowerDifficulty,
  { cols: number; dragons: number }
> = {
  easy:   { cols: 4, dragons: 1 },
  medium: { cols: 3, dragons: 1 },
  hard:   { cols: 2, dragons: 1 },
  expert: { cols: 3, dragons: 2 },
};

// Step multiplier per row (1% edge): 0.99 / P(safe)
export function dragonTowerStep(difficulty: DragonTowerDifficulty): number {
  const { cols, dragons } = DIFFICULTY_CONFIG[difficulty];
  const safe = cols - dragons;
  return Math.floor((0.99 / (safe / cols)) * 1000) / 1000;
}

export function dragonTowerConfig(
  difficulty: DragonTowerDifficulty
): { cols: number; dragons: number; rows: number } {
  return { ...DIFFICULTY_CONFIG[difficulty], rows: ROWS };
}

// Pre-compute dragon columns for every row using partial Fisher-Yates
function computeDragonPositions(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  difficulty: DragonTowerDifficulty,
): number[][] {
  const { cols, dragons } = DIFFICULTY_CONFIG[difficulty];
  const result: number[][] = [];
  for (let row = 0; row < ROWS; row++) {
    const pool = Array.from({ length: cols }, (_, i) => i);
    const dragonCols: number[] = [];
    for (let d = 0; d < dragons; d++) {
      const r = generateOutcome(serverSeed, clientSeed, nonce, row * MAX_COLS + d);
      const j = Math.floor(r * (cols - d));
      dragonCols.push(pool[j]);
      pool[j] = pool[cols - 1 - d];
    }
    result.push(dragonCols);
  }
  return result;
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface DragonTowerState {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  betAmount: number;
  difficulty: DragonTowerDifficulty;
  dragonPositions: number[][];  // [row][dragon_col_indices]; hidden from client until reveal
  currentRow: number;           // next row to climb (0 = bottom)
  multiplier: number;
}

// ─── Start ────────────────────────────────────────────────────────────────────

export interface DragonTowerStartResult {
  state: string;
  serverSeedHash: string;
  clientSeed: string;
  rows: number;
  cols: number;
  step: number;
}

export function dragonTowerStart(
  betAmount: number,
  difficulty: DragonTowerDifficulty,
  seeds: SeedInput = freshSeeds(),
): DragonTowerStartResult {
  const { serverSeed, clientSeed, nonce } = seeds;

  const dragonPositions = computeDragonPositions(serverSeed, clientSeed, nonce, difficulty);
  const { cols } = DIFFICULTY_CONFIG[difficulty];

  const st: DragonTowerState = {
    serverSeed, clientSeed, nonce, betAmount, difficulty,
    dragonPositions, currentRow: 0, multiplier: 1,
  };

  return {
    state: Buffer.from(JSON.stringify(st)).toString("base64"),
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed,
    rows: ROWS,
    cols,
    step: dragonTowerStep(difficulty),
  };
}

// ─── Climb ────────────────────────────────────────────────────────────────────

export interface DragonTowerClimbResult {
  safe: boolean;
  dragonCols: number[];    // dragon columns for this row (revealed either way)
  pickedCol: number;
  multiplier: number;
  currentProfit: number;
  profit: number;          // only meaningful if !safe (= −betAmount)
  state: string | null;    // updated state (null if bust or all rows cleared)
  serverSeed: string | null;
  cleared: boolean;        // true if player climbed all 9 rows
}

export function dragonTowerClimb(
  encodedState: string,
  col: number,
): DragonTowerClimbResult | { error: string } {
  let st: DragonTowerState;
  try { st = JSON.parse(Buffer.from(encodedState, "base64").toString()); }
  catch { return { error: "Invalid state" }; }

  if (st.currentRow >= ROWS) return { error: "Tower already cleared" };

  const dragonCols = st.dragonPositions[st.currentRow];
  const safe = !dragonCols.includes(col);
  const step = dragonTowerStep(st.difficulty);

  if (!safe) {
    return {
      safe: false,
      dragonCols,
      pickedCol: col,
      multiplier: 0,
      currentProfit: 0,
      profit: -st.betAmount,
      state: null,
      serverSeed: st.serverSeed,
      cleared: false,
    };
  }

  const newMultiplier = Math.floor(st.multiplier * step * 1000) / 1000;
  const newRow = st.currentRow + 1;
  const cleared = newRow >= ROWS;

  const newSt: DragonTowerState = { ...st, currentRow: newRow, multiplier: newMultiplier };
  const profit = cleared ? Math.floor(st.betAmount * (newMultiplier - 1)) : 0;

  return {
    safe: true,
    dragonCols,
    pickedCol: col,
    multiplier: newMultiplier,
    currentProfit: Math.floor(st.betAmount * (newMultiplier - 1)),
    profit,
    state: cleared ? null : Buffer.from(JSON.stringify(newSt)).toString("base64"),
    serverSeed: cleared ? st.serverSeed : null,
    cleared,
  };
}

// ─── Cashout ──────────────────────────────────────────────────────────────────

export interface DragonTowerCashoutResult {
  multiplier: number;
  profit: number;
  serverSeed: string;
  allDragonPositions: number[][];
}

export function dragonTowerCashout(
  encodedState: string,
): DragonTowerCashoutResult | { error: string } {
  let st: DragonTowerState;
  try { st = JSON.parse(Buffer.from(encodedState, "base64").toString()); }
  catch { return { error: "Invalid state" }; }

  if (st.currentRow === 0) return { error: "No rows climbed yet" };

  return {
    multiplier: st.multiplier,
    profit: Math.floor(st.betAmount * (st.multiplier - 1)),
    serverSeed: st.serverSeed,
    allDragonPositions: st.dragonPositions,
  };
}
