import { coinsToCents } from "@/engine/wallet/money";

/** Branding lives here so the name can be swapped in one place (also update app.json). */
export const APP_NAME = "ZeroSteak";
export const APP_TAGLINE = "Offline casino simulator. Play money only.";
export const CURRENCY_NAME = "Coins";

export const DEFAULT_STARTING_BALANCE = coinsToCents(10_000);
export const STARTING_BALANCE_OPTIONS = [1_000, 10_000, 100_000, 1_000_000].map(coinsToCents);

export const DISCLAIMER =
  "ZeroSteak is a simulated casino game for entertainment. Coins are fictional, have no monetary value, " +
  "and cannot be bought, sold, withdrawn or redeemed. No real-money gambling is offered.";
