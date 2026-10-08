/**
 * Raw colour values for places that can't use classes (icons, SVG, Skia,
 * navigation). Mirrors src/global.css — keep them in sync.
 *
 * `C` = app chrome (light, white page). `B` = game boards (always dark).
 */
export const C = {
  page: "#ffffff",
  surface: "#f5f3ef",
  surface2: "#ebe8e2",
  line: "#e4e0d8",
  ink: "#141312",
  soft: "#6b655e",
  red: "#f0384c",
  blue: "#2f6bf0",
  gold: "#ffc21a",
  mint: "#16c98d",
  pos: "#0a7d55",
  neg: "#cf2438",
} as const;

export const B = {
  board: "#1b1a18",
  tile: "#2c2a27",
  tileRaised: "#3a3733",
  well: "#242220",
  ink: "#f5f1ea",
  soft: "#b5ada3",
  win: "#22d69a",
  loss: "#ff4d5e",
  gold: "#ffc21a",
  sky: "#4c8dff",
  violet: "#a77bff",
  orange: "#ff8a3d",
  winTint: "#173a2e",
  lossTint: "#43181f",
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
