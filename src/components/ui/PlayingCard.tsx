"use client";

import { cn } from "@/lib/cn";
import { rankLabel, suitSymbol, isRedSuit, type Card } from "@/lib/game-engine/cards";

interface PlayingCardProps {
  card?: Card;        // omit + faceDown for a hidden card
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "w-10 h-14 text-sm rounded-md",
  md: "w-14 h-20 text-lg rounded-lg",
  lg: "w-20 h-28 text-2xl rounded-xl",
} as const;

export function PlayingCard({ card, faceDown, size = "md", className }: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div
        className={cn(
          SIZES[size],
          "flex items-center justify-center border border-[var(--border)]",
          "bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface)]",
          "shadow-inner",
          className
        )}
      >
        <div className="w-1/2 h-1/2 rounded border border-[var(--accent)]/30 bg-[var(--accent)]/5" />
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  return (
    <div
      className={cn(
        SIZES[size],
        "relative flex flex-col justify-between p-1.5 font-bold",
        "bg-[#f6f5fb] border border-black/10 shadow-md select-none",
        red ? "text-red-600" : "text-neutral-900",
        className
      )}
    >
      <span className="leading-none">{rankLabel(card.rank)}</span>
      <span className="absolute inset-0 flex items-center justify-center text-[1.6em] opacity-90">
        {suitSymbol(card.suit)}
      </span>
      <span className="self-end leading-none rotate-180">{rankLabel(card.rank)}</span>
    </div>
  );
}
