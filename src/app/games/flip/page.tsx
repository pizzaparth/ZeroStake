"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CircleDollarSign } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { GameShell, type ProvablyFair } from "@/components/ui/GameShell";
import { ResultBanner } from "@/components/ui/ResultBanner";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { getFlipMultiplier, type Side } from "@/lib/game-engine/flip";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";

interface FlipResponse {
  flips: Side[]; side: Side; streak: number; targetStreak: number; win: boolean;
  multiplier: number; profit: number;
  serverSeed?: string; serverSeedHash: string; clientSeed: string; nonce: number;
  balance?: number;
}

const STREAKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Coin({ side, revealed }: { side: Side | null; revealed: boolean }) {
  return (
    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-lg font-black border-2 transition-all",
      !revealed ? "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)]"
        : side === "heads" ? "bg-amber-400 border-amber-300 text-amber-900"
          : "bg-slate-300 border-slate-200 text-slate-800")}>
      {!revealed ? "?" : side === "heads" ? "H" : "T"}
    </div>
  );
}

export default function FlipPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [side, setSide] = useState<Side>("heads");
  const [targetStreak, setTargetStreak] = useState(1);
  const [flipping, setFlipping] = useState(false);
  const [revealed, setRevealed] = useState<Side[]>([]);
  const [last, setLast] = useState<FlipResponse | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const multiplier = getFlipMultiplier(targetStreak);

  const flip = useCallback(async () => {
    if (betAmount > balance || flipping) return;
    setFlipping(true);
    setLast(null);
    setRevealed([]);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    try {
      const res = await playFetch("/api/games/flip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, side, targetStreak, clientSeed }),
      });
      const data: FlipResponse = await res.json();
      // Reveal flips one at a time
      data.flips.forEach((f, i) => {
        timers.current.push(setTimeout(() => setRevealed((r) => [...r, f]), (i + 1) * 350));
      });
      const total = data.flips.length * 350 + 200;
      timers.current.push(setTimeout(() => {
        if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
        setLast(data);
        setFlipping(false);
      }, total));
    } catch {
      setFlipping(false);
    }
  }, [betAmount, balance, side, targetStreak, flipping, applyProfit, syncBalance, clientSeed]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const fair: ProvablyFair | null = last
    ? { serverSeed: last.serverSeed, serverSeedHash: last.serverSeedHash, clientSeed: last.clientSeed, nonce: last.nonce,
        extra: [{ label: "Flips", value: last.flips.map((f) => (f === "heads" ? "H" : "T")).join(" ") }] }
    : null;

  return (
    <GameShell title="Flip" subtitle="Pick a side · Chain a streak · 1.98× per flip"
      icon={CircleDollarSign} iconClass="bg-amber-500/10 border-amber-500/20 text-amber-400" fair={fair}>
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Coin display — fills available space */}
        <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center py-16 px-4 min-h-[260px]">
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: targetStreak }).map((_, i) => (
              <Coin key={i} side={revealed[i] ?? null} revealed={i < revealed.length} />
            ))}
          </div>
          <div className="min-h-[24px] mt-6">
            <ResultBanner profit={last ? last.profit : null}
              label={last ? (last.win ? `${last.multiplier.toFixed(2)}×` : `Broke at ${last.streak}/${last.targetStreak}`) : undefined} />
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-full lg:w-72 shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Side</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["heads", "tails"] as Side[]).map((s) => (
                <button key={s} onClick={() => setSide(s)} disabled={flipping}
                  className={cn("py-2.5 rounded-lg border text-sm font-bold capitalize transition-all",
                    side === s ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_14px_rgba(139,92,246,0.3)]"
                      : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--muted)] uppercase tracking-wider">
              Target Streak · <span className="text-[var(--accent)]">{multiplier.toFixed(2)}×</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {STREAKS.map((n) => (
                <button key={n} onClick={() => setTargetStreak(n)} disabled={flipping}
                  className={cn("py-1.5 rounded-lg border text-xs font-bold transition-all",
                    targetStreak === n ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                      : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]")}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <BetInput value={betAmount} onChange={setBetAmount} disabled={flipping} />
          <button onClick={flip} disabled={flipping || betAmount > balance}
            className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
              "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
              "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
              "disabled:opacity-40 disabled:cursor-not-allowed")}>
            {flipping ? "Flipping…" : targetStreak === 1 ? "Flip" : `Flip ${targetStreak}×`}
          </button>
        </div>
      </div>
    </GameShell>
  );
}
