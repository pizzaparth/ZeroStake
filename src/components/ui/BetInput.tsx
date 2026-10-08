"use client";

import { cn } from "@/lib/cn";
import { useBalance } from "@/context/BalanceContext";

interface BetInputProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}

export function BetInput({ value, onChange, disabled, className }: BetInputProps) {
  const { balance, fmt } = useBalance();
  const max = balance;

  function adjust(factor: number) {
    const next = Math.min(max, Math.max(100, Math.round(value * factor)));
    onChange(next);
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Bet Amount</label>
      {/* Input row */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--accent)] text-sm font-bold">$</span>
        <input
          type="number"
          min={1}
          max={max / 100}
          step={0.01}
          value={(value / 100).toFixed(2)}
          onChange={(e) => {
            const raw = Math.round(parseFloat(e.target.value || "0") * 100);
            onChange(Math.min(max, Math.max(100, raw)));
          }}
          disabled={disabled}
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg pl-7 pr-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      {/* Quick-adjust buttons */}
      <div className="grid grid-cols-3 gap-1.5">
        {([["½", () => adjust(0.5)], ["2×", () => adjust(2)], ["Max", () => onChange(max)]] as const).map(
          ([label, handler]) => (
            <button
              key={label}
              onClick={handler}
              disabled={disabled}
              className="py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
            >
              {label}
            </button>
          )
        )}
      </div>
      <p className="text-xs text-[var(--muted)]">Balance: <span className="text-[var(--text)]">${fmt(balance)}</span></p>
    </div>
  );
}
