import type { Cents } from "./money";

/**
 * Ledger entry kinds. A finished bet produces BET (stake out) and, when it
 * returned anything, PAYOUT (return in). WIN/LOSS describe a bet's result on
 * the bet record itself rather than separate ledger rows.
 */
export type TransactionType = "BET" | "PAYOUT" | "RESET_BALANCE" | "BONUS";

export interface Transaction {
  id: number;
  type: TransactionType;
  /** Signed change applied to the balance. */
  amount: Cents;
  balanceAfter: Cents;
  betId: number | null;
  createdAt: number;
  note: string | null;
}

export type BetStatus = "active" | "settled";
export type BetResult = "win" | "loss" | "push";

export function resultFor(bet: Cents, payout: Cents): BetResult {
  if (payout > bet) return "win";
  if (payout === bet) return "push";
  return "loss";
}
