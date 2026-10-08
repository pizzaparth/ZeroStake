import { floorTo } from "../probability/houseEdge";

/**
 * All coin amounts are integers in "cents" (1 coin = 100 cents) so the ledger
 * never accumulates floating-point drift. Only display code converts back.
 */
export type Cents = number;

export const CENTS_PER_COIN = 100;

export function coinsToCents(coins: number): Cents {
  return Math.round(coins * CENTS_PER_COIN);
}

export function centsToCoins(cents: Cents): number {
  return cents / CENTS_PER_COIN;
}

/** Total returned for a stake at a multiplier, truncated to whole cents. */
export function payoutFor(bet: Cents, multiplier: number): Cents {
  if (multiplier <= 0) return 0;
  return Math.floor(floorTo(bet * multiplier, 6));
}

/** Parses user text like "12.5" or "1,000" into cents; null if invalid. */
export function parseCoins(text: string): Cents | null {
  const cleaned = text.replace(/,/g, "").trim();
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  return coinsToCents(Number(cleaned));
}

const fmt2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCoins(cents: Cents): string {
  return fmt2.format(centsToCoins(cents));
}

/** Compact form for tight spaces: 12.3K, 4.56M. */
export function formatCoinsCompact(cents: Cents): string {
  const coins = centsToCoins(cents);
  const abs = Math.abs(coins);
  if (abs >= 1e9) return `${(coins / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(coins / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${(coins / 1e3).toFixed(1)}K`;
  return fmt2.format(coins);
}

export function formatSigned(cents: Cents): string {
  if (cents > 0) return `+${formatCoins(cents)}`;
  if (cents < 0) return `−${formatCoins(-cents)}`;
  return formatCoins(0);
}

export function formatMultiplier(m: number, decimals = 2): string {
  return `${floorTo(m, decimals).toFixed(decimals)}×`;
}
