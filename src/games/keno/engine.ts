import { createFloatStream } from "@/engine/rng/byteGenerator";
import { sampleWithoutReplacement } from "@/engine/probability/distributions";
import type { InstantGame } from "../types";
import { KENO_DRAWS, KENO_MAX_PICKS, KENO_TILES, kenoMultiplier } from "./payouts";

/**
 * Keno — tiles numbered 1–40. Draw: partial Fisher–Yates, cursor i for the
 * i-th of 10 draws (original layout).
 */

export interface KenoParams {
  picks: number[];
}

export interface KenoOutcome {
  picks: number[];
  drawn: number[];
  hits: number;
}

export function isValidKenoPicks(picks: number[]): boolean {
  return (
    picks.length >= 1 &&
    picks.length <= KENO_MAX_PICKS &&
    new Set(picks).size === picks.length &&
    picks.every((p) => Number.isInteger(p) && p >= 1 && p <= KENO_TILES)
  );
}

export const kenoGame: InstantGame<KenoParams, KenoOutcome> = {
  kind: "instant",
  play(seeds, { picks }) {
    if (!isValidKenoPicks(picks)) throw new Error("Invalid keno picks");
    const stream = createFloatStream(seeds);
    const drawn = sampleWithoutReplacement(KENO_TILES, KENO_DRAWS, stream.at).map((i) => i + 1);
    const drawnSet = new Set(drawn);
    const hits = picks.filter((p) => drawnSet.has(p)).length;
    return { multiplier: kenoMultiplier(picks.length, hits), stakeUnits: 1, outcome: { picks, drawn, hits } };
  },
};
