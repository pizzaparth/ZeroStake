import type { Cents } from "./money";

/** Pure balance rules; persistence applies these inside one SQLite transaction. */

export const MIN_BET: Cents = 0; // 0 allowed: free "demo" spins that still record history

export function canAfford(balance: Cents, bet: Cents): boolean {
  return Number.isInteger(bet) && bet >= MIN_BET && bet <= balance;
}

export function applyBet(balance: Cents, bet: Cents): Cents {
  if (!canAfford(balance, bet)) throw new Error("Insufficient balance");
  return balance - bet;
}

export function applyPayout(balance: Cents, payout: Cents): Cents {
  if (!Number.isInteger(payout) || payout < 0) throw new Error("Invalid payout");
  return balance + payout;
}
