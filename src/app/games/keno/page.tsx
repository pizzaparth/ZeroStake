"use client";

import { useState, useCallback } from "react";
import { Grid3X3 } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { GameShell, type ProvablyFair } from "@/components/ui/GameShell";
import { ResultBanner } from "@/components/ui/ResultBanner";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { getKenoMultiplier, type KenoSpot } from "@/lib/game-engine/keno";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";

interface KenoResponse {
  picks: number[]; drawn: number[]; hits: number;
  multiplier: number; profit: number;
  serverSeed?: string; serverSeedHash: string; clientSeed: string; nonce: number;
  balance?: number;
}

// Payout table preview for current pick count — shows only non-zero entries
function PayoutRow({ picks, hits }: { picks: number; hits: number }) {
  const m = getKenoMultiplier(picks as KenoSpot, hits);
  if (m === 0) return null;
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[var(--muted)]">{hits} hit{hits !== 1 ? "s" : ""}</span>
      <span className="text-[var(--accent)] font-bold">{m}×</span>
    </div>
  );
}

export default function KenoPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [last, setLast] = useState<KenoResponse | null>(null);

  const drawnSet = last ? new Set(last.drawn) : null;
  const picksArr = Array.from(picks);

  const togglePick = useCallback((n: number) => {
    if (playing) return;
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) { next.delete(n); return next; }
      if (next.size >= 10) return prev;
      next.add(n);
      return next;
    });
  }, [playing]);

  const play = useCallback(async () => {
    if (picksArr.length === 0 || betAmount > balance || playing) return;
    setPlaying(true);
    setLast(null);
    try {
      const res = await playFetch("/api/games/keno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, picks: picksArr, clientSeed }),
      });
      const data: KenoResponse = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
      setLast(data);
    } finally {
      setPlaying(false);
    }
  }, [picksArr, betAmount, balance, playing, applyProfit, syncBalance, clientSeed]);

  const fair: ProvablyFair | null = last
    ? { serverSeed: last.serverSeed, serverSeedHash: last.serverSeedHash, clientSeed: last.clientSeed, nonce: last.nonce,
        extra: [{ label: "Drawn", value: last.drawn.sort((a, b) => a - b).join(", ") }] }
    : null;

  const numPicks = picksArr.length as KenoSpot;

  return (
    <GameShell title="Keno" subtitle="Pick 1–10 tiles · 10 drawn · win by matches"
      icon={Grid3X3} iconClass="bg-teal-500/10 border-teal-500/20 text-teal-400" fair={fair}>
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Grid display */}
        <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-4">
          <div className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
              const isPick = picks.has(n);
              const isDrawn = drawnSet?.has(n) ?? false;
              const isHit = isPick && isDrawn;
              const isMiss = isPick && !isDrawn && drawnSet !== null;
              const isDrawnOnly = !isPick && isDrawn;
              return (
                <button
                  key={n}
                  onClick={() => togglePick(n)}
                  disabled={playing}
                  className={cn(
                    "aspect-square rounded-lg text-xs font-bold transition-all border",
                    isHit
                      ? "bg-teal-500 border-teal-400 text-white shadow-[0_0_8px_rgba(20,184,166,0.5)]"
                      : isMiss
                      ? "bg-red-900/40 border-red-700/50 text-red-400"
                      : isDrawnOnly
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : isPick
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_8px_rgba(139,92,246,0.4)]"
                      : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]/40"
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-xs text-[var(--muted)]">
              <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--accent)] mr-1" />Your picks</span>
              <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-teal-500 mr-1" />Hit</span>
              <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/40 mr-1" />Drawn</span>
            </div>
            <ResultBanner profit={last ? last.profit : null}
              label={last ? (last.hits > 0 ? `${last.hits} hit · ${last.multiplier}×` : "0 hits") : undefined} />
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-full lg:w-72 shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Picks</span>
              <span className="text-sm font-bold text-[var(--text)]">{picksArr.length} / 10</span>
            </div>
            {picksArr.length > 0 && (
              <button onClick={() => setPicks(new Set())} disabled={playing}
                className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
                Clear all
              </button>
            )}
          </div>

          {numPicks > 0 && (
            <div className="space-y-1 border border-[var(--border)] rounded-xl p-3">
              <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-2">
                Payout · {numPicks} pick{numPicks !== 1 ? "s" : ""}
              </p>
              {Array.from({ length: numPicks + 1 }, (_, hits) => (
                <PayoutRow key={hits} picks={numPicks} hits={hits} />
              ))}
            </div>
          )}

          <BetInput value={betAmount} onChange={setBetAmount} disabled={playing} />
          <button
            onClick={play}
            disabled={playing || picksArr.length === 0 || betAmount > balance}
            className={cn(
              "w-full py-3 rounded-xl font-black text-base transition-all",
              "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
              "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {playing ? "Drawing…" : picksArr.length === 0 ? "Pick tiles to play" : "Play Keno"}
          </button>
        </div>
      </div>
    </GameShell>
  );
}
