"use client";

import { useState, useCallback } from "react";
import { Gem } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { GameShell, type ProvablyFair } from "@/components/ui/GameShell";
import { ResultBanner } from "@/components/ui/ResultBanner";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { getDiamondsMultiplier, type GemType } from "@/lib/game-engine/diamonds";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";

interface DiamondsResponse {
  picks: number[]; tiles: GemType[]; diamondPositions: number[];
  hits: number; multiplier: number; profit: number;
  serverSeed?: string; serverSeedHash: string; clientSeed: string; nonce: number;
  balance?: number;
}

const GEM_COLORS: Record<GemType, string> = {
  diamond: "bg-cyan-400/20 border-cyan-400 text-cyan-300",
  ruby:    "bg-red-500/20  border-red-400  text-red-300",
  emerald: "bg-emerald-500/20 border-emerald-400 text-emerald-300",
  sapphire: "bg-blue-500/20 border-blue-400 text-blue-300",
  topaz:   "bg-amber-500/20 border-amber-400 text-amber-300",
};

const GEM_LABEL: Record<GemType, string> = {
  diamond: "💎", ruby: "❤️", emerald: "💚", sapphire: "💙", topaz: "🧡",
};

const PAYOUT_ROWS: { hits: number; label: string }[] = [
  { hits: 0, label: "0 hits" },
  { hits: 1, label: "1 hit" },
  { hits: 2, label: "2 hits" },
  { hits: 3, label: "3 hits" },
];

function TileButton({
  picked, revealed, gem, isHit, onClick, disabled,
}: {
  picked: boolean; revealed: boolean; gem: GemType | null;
  isHit: boolean; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "aspect-square rounded-2xl flex items-center justify-center text-2xl border-2 transition-all",
        revealed && gem
          ? cn(GEM_COLORS[gem], isHit && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-[var(--surface)] shadow-[0_0_16px_rgba(34,211,238,0.5)]")
          : picked
          ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)] shadow-[0_0_12px_rgba(139,92,246,0.3)]"
          : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
      )}
    >
      {revealed && gem ? GEM_LABEL[gem] : picked ? "●" : "?"}
    </button>
  );
}

export default function DiamondsPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [last, setLast] = useState<DiamondsResponse | null>(null);

  const toggle = useCallback((i: number) => {
    if (playing) return;
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); return next; }
      if (next.size >= 4) return prev;
      next.add(i);
      return next;
    });
  }, [playing]);

  const play = useCallback(async () => {
    if (picks.size !== 4 || betAmount > balance || playing) return;
    setPlaying(true);
    setLast(null);
    try {
      const res = await playFetch("/api/games/diamonds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, picks: Array.from(picks), clientSeed }),
      });
      const data: DiamondsResponse = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
      setLast(data);
    } finally {
      setPlaying(false);
    }
  }, [picks, betAmount, balance, playing, applyProfit, syncBalance, clientSeed]);

  const hitSet = last ? new Set(last.diamondPositions) : null;

  const fair: ProvablyFair | null = last
    ? { serverSeed: last.serverSeed, serverSeedHash: last.serverSeedHash, clientSeed: last.clientSeed, nonce: last.nonce,
        extra: [{ label: "Diamonds at", value: last.diamondPositions.map((p) => p + 1).join(", ") }] }
    : null;

  const canPlay = picks.size === 4 && betAmount <= balance && !playing;

  return (
    <GameShell title="Diamonds" subtitle="Pick 4 tiles · Find the hidden diamonds · 3 hits = 18×"
      icon={Gem} iconClass="bg-cyan-500/10 border-cyan-500/20 text-cyan-400" fair={fair}>
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Grid display */}
        <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center justify-center gap-6 min-h-[260px]">
          <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <TileButton
                key={i}
                picked={picks.has(i)}
                revealed={last !== null}
                gem={last ? last.tiles[i] : null}
                isHit={hitSet?.has(i) ?? false}
                onClick={() => { if (!last) toggle(i); }}
                disabled={playing || (!!last)}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <ResultBanner profit={last ? last.profit : null}
              label={last ? (last.hits > 0 ? `${last.hits} diamond${last.hits !== 1 ? "s" : ""}! ${last.multiplier}×` : "No diamonds") : undefined} />
            {last && (
              <button onClick={() => { setLast(null); setPicks(new Set()); }}
                className="text-xs text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] rounded-lg px-3 py-1.5 transition-colors">
                New round
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="w-full lg:w-72 shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Picks</span>
            <span className="text-sm font-bold text-[var(--text)]">{picks.size} / 4</span>
          </div>

          <div className="space-y-1 border border-[var(--border)] rounded-xl p-3">
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-2">Payout · Pick 4</p>
            {PAYOUT_ROWS.map(({ hits, label }) => (
              <div key={hits} className="flex justify-between text-xs">
                <span className="text-[var(--muted)]">{label}</span>
                <span className={cn("font-bold", getDiamondsMultiplier(hits) > 0 ? "text-[var(--accent)]" : "text-[var(--muted)]")}>
                  {getDiamondsMultiplier(hits) > 0 ? `${getDiamondsMultiplier(hits)}×` : "—"}
                </span>
              </div>
            ))}
          </div>

          <BetInput value={betAmount} onChange={setBetAmount} disabled={playing || !!last} />
          <button
            onClick={last ? () => { setLast(null); setPicks(new Set()); } : play}
            disabled={!last && !canPlay}
            className={cn(
              "w-full py-3 rounded-xl font-black text-base transition-all",
              "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
              "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {playing ? "Revealing…" : last ? "Play Again" : picks.size < 4 ? `Pick ${4 - picks.size} more` : "Find Diamonds"}
          </button>
        </div>
      </div>
    </GameShell>
  );
}
