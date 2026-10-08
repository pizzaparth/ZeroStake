/**
 * Raw colour values for places that can't use classes (icons, SVG, Skia,
 * navigation). Mirrors src/global.css — keep them in sync.
 *
 * `C` = app chrome (light, white page). `B` = game boards (always dark).
 */
export const C = {
  page: "#ffffff",
  surface: "#f8f8fb",
  surface2: "#f0f0f5",
  line: "#e5e5ea",
  ink: "#111113",
  soft: "#8e8e93",
  red: "#ff3b30",
  blue: "#007aff",
  gold: "#ffcc00",
  mint: "#34c759",
  pos: "#34c759",
  neg: "#ff3b30",
} as const;

export const B = {
  board: "#ffffff",
  tile: "#f0f0f5",
  tileRaised: "#ffffff",
  well: "#f8f8fb",
  ink: "#111113",
  soft: "#8e8e93",
  win: "#34c759",
  loss: "#ff3b30",
  gold: "#ffcc00",
  sky: "#5ac8fa",
  violet: "#af52de",
  orange: "#ff9500",
  winTint: "#e8f7ee",
  lossTint: "#ffebe9",
} as const;

export type ChipColor = "red" | "blue" | "gold" | "mint";

/** Fill and readable text colour for each chip accent. */
export const CHIPS: Record<ChipColor, { fill: string; text: string }> = {
  red: { fill: C.red, text: "#ffffff" },
  blue: { fill: C.blue, text: "#ffffff" },
  gold: { fill: C.gold, text: C.ink },
  mint: { fill: C.mint, text: C.ink },
};

/** Motion presets. Direct-manipulation feedback stays under 100 ms. */
export const MOTION = {
  press: { duration: 90 },
  release: { duration: 140 },
  spring: { damping: 20, stiffness: 380, mass: 0.6 },
  pressScale: 0.97,
} as const;
