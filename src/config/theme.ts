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
