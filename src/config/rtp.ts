/**
 * Central theoretical-RTP configuration. Games derive multipliers from these
 * numbers instead of hard-coding 0.99 locally.
 *
 * Games whose return comes from a fixed classic paytable (Wheel, Diamonds,
 * Video Poker, Blackjack) are not listed: their RTP is *computed* from the
 * table/rules and shown in the info panel, preserving the original design.
 */
export const DEFAULT_RTP = 0.99;

export const GAME_RTP = {
  dice: DEFAULT_RTP,
  limbo: DEFAULT_RTP,
  crash: DEFAULT_RTP,
  mines: DEFAULT_RTP,
  dragonTower: DEFAULT_RTP,
  hilo: DEFAULT_RTP,
  flip: DEFAULT_RTP,
  keno: DEFAULT_RTP,
  plinko: DEFAULT_RTP,
} as const;
