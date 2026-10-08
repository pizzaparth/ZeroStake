import { createFloatStream, floatToInt } from "@/engine/rng/byteGenerator";
import type { InstantGame } from "../types";

/**
 * Wheel — a ring of equally likely segments, each with a multiplier. Ported
 * unchanged: each base ring has 10 segments and is tiled to 10–50 segments, so
 * odds don't depend on size. RTP = mean multiplier of the ring (computed, not
 * hard-coded): low 96%, medium 96%, high 97%, as the original designed.
 */

export type WheelRisk = "low" | "medium" | "high";
export type WheelSegments = 10 | 20 | 30 | 40 | 50;
export const WHEEL_SEGMENT_OPTIONS: WheelSegments[] = [10, 20, 30, 40, 50];

const BASE_RINGS: Record<WheelRisk, number[]> = {
  low: [1.5, 1.2, 1.5, 0, 1.2, 1.5, 1.2, 0, 1.5, 0],
  medium: [1.5, 0, 3, 0, 1.8, 0, 1.5, 0, 1.8, 0],
  high: [0, 0, 0, 0, 8, 0, 0, 0, 1.7, 0],
};

export function wheelRing(segments: WheelSegments, risk: WheelRisk): number[] {
  const base = BASE_RINGS[risk];
  return Array.from({ length: segments }, (_, i) => base[i % base.length]);
}

export function wheelRtp(risk: WheelRisk): number {
  const base = BASE_RINGS[risk];
  return base.reduce((a, b) => a + b, 0) / base.length;
}

export interface WheelParams {
  segments: WheelSegments;
  risk: WheelRisk;
}

export interface WheelOutcome {
  segmentIndex: number;
  segments: WheelSegments;
  risk: WheelRisk;
}

export const wheelGame: InstantGame<WheelParams, WheelOutcome> = {
  kind: "instant",
  play(seeds, { segments, risk }) {
    if (!WHEEL_SEGMENT_OPTIONS.includes(segments) || !(risk in BASE_RINGS)) throw new Error("Invalid wheel");
    const ring = wheelRing(segments, risk);
    const segmentIndex = floatToInt(createFloatStream(seeds).next(), ring.length);
    return { multiplier: ring[segmentIndex], stakeUnits: 1, outcome: { segmentIndex, segments, risk } };
  },
};
