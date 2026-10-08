import { createFloatStream } from "@/engine/rng/byteGenerator";
import type { InstantGame } from "../types";
import { PLINKO_ROW_OPTIONS, plinkoTable, type PlinkoRisk, type PlinkoRows } from "./payouts";

/**
 * Plinko — the path is decided by the RNG first (cursor r → row r; < 0.5 is
 * left), and the animation only replays that path. Physics never decides money.
 */

export type PlinkoDirection = "L" | "R";

export interface PlinkoParams {
  rows: PlinkoRows;
  risk: PlinkoRisk;
}

export interface PlinkoOutcome {
  path: PlinkoDirection[];
  bucket: number;
  rows: PlinkoRows;
  risk: PlinkoRisk;
}

export const plinkoGame: InstantGame<PlinkoParams, PlinkoOutcome> = {
  kind: "instant",
  play(seeds, { rows, risk }) {
    if (!PLINKO_ROW_OPTIONS.includes(rows)) throw new Error("Invalid rows");
    const stream = createFloatStream(seeds);
    const path: PlinkoDirection[] = Array.from({ length: rows }, () => (stream.next() < 0.5 ? "L" : "R"));
    const bucket = path.filter((d) => d === "R").length;
    return { multiplier: plinkoTable(rows, risk)[bucket], stakeUnits: 1, outcome: { path, bucket, rows, risk } };
  },
};
