"use client";

import { cn } from "@/lib/cn";

interface ResultBannerProps {
  /** Profit in minor units (chips ×100). Positive = win, negative = loss. */
  profit: number | null;
  /** Optional label shown before the amount, e.g. "3 of a Kind" or "2.5×". */
  label?: string;
  className?: string;
}

/** Shared win/loss banner used across game pages. Renders nothing when idle. */
export function ResultBanner({ profit, label, className }: ResultBannerProps) {
  if (profit === null) return null;
  const win = profit >= 0;
  return (
    <p
      className={cn(
        "text-center text-sm font-black",
        win ? "text-[var(--win)]" : "text-[var(--lose)]",
        className
      )}
    >
      {label ? `${label} · ` : ""}
      {win ? "+" : ""}
      ${(profit / 100).toFixed(2)}
    </p>
  );
}
