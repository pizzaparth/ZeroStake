"use client";

import { useState, useCallback } from "react";
import { LayoutGrid } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { GameShell, type ProvablyFair } from "@/components/ui/GameShell";
import { ResultBanner } from "@/components/ui/ResultBanner";
import { PlayingCard } from "@/components/ui/PlayingCard";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { videoPokerPayout, type Card, type PokerCategory } from "@/lib/game-engine";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";

interface DealResponse {
  hand: Card[]; state?: string; token?: string; serverSeedHash: string; clientSeed: string; nonce?: number; balance?: number;
}
interface DrawResponse {
  finalHand: Card[]; category: PokerCategory; label: string;
  multiplier: number; profit: number; serverSeed?: string; balance?: number;
}

const PAYTABLE: { category: PokerCategory; label: string }[] = [
  { category: "royal_flush", label: "Royal Flush" },
  { category: "straight_flush", label: "Straight Flush" },
  { category: "four_of_a_kind", label: "Four of a Kind" },
  { category: "full_house", label: "Full House" },
  { category: "flush", label: "Flush" },
  { category: "straight", label: "Straight" },
  { category: "three_of_a_kind", label: "Three of a Kind" },
  { category: "two_pair", label: "Two Pair" },
  { category: "jacks_or_better", label: "Jacks or Better" },
];

type Phase = "idle" | "holding" | "done";

export default function VideoPokerPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed: settingsSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);

  const [hand, setHand] = useState<Card[]>([]);
  const [holds, setHolds] = useState<boolean[]>([false, false, false, false, false]);
  const [gameState, setGameState] = useState<string | null>(null);
  const [gameToken, setGameToken] = useState<string | null>(null);
  const [result, setResult] = useState<DrawResponse | null>(null);

  const [serverSeedHash, setServerSeedHash] = useState("");
  // The round's own client seed and nonce, from the start response: for a
  // logged-in player that's the seed pair's, not the local settings seed.
  const [roundSeed, setRoundSeed] = useState({ clientSeed: "", nonce: 0 });

  const deal = useCallback(async () => {
    if (betAmount > balance || busy) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/video-poker/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, clientSeed: settingsSeed }),
      });
      const data: DealResponse = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance);
      setHand(data.hand);
      setHolds([false, false, false, false, false]);
      setGameState(data.state ?? null);
      setGameToken(data.token ?? null);
      setServerSeedHash(data.serverSeedHash);
      setRoundSeed({ clientSeed: data.clientSeed, nonce: data.nonce ?? 0 });
      setResult(null);
      setPhase("holding");
    } finally {
      setBusy(false);
    }
  }, [betAmount, balance, busy, settingsSeed, syncBalance]);

  const toggleHold = (i: number) => {
    if (phase !== "holding" || busy) return;
    setHolds((h) => h.map((v, idx) => (idx === i ? !v : v)));
  };

  const draw = useCallback(async () => {
    if ((!gameState && !gameToken) || busy) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/video-poker/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(gameToken ? { token: gameToken } : { state: gameState }), holds }),
      });
      const data: DrawResponse = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
      setHand(data.finalHand);
      setResult(data);
      setGameState(null);
      setGameToken(null);
      setPhase("done");
    } finally {
      setBusy(false);
    }
  }, [gameState, gameToken, holds, busy, applyProfit, syncBalance]);

  const reset = () => { setPhase("idle"); setHand([]); setResult(null); setHolds([false, false, false, false, false]); };

  const fair: ProvablyFair | null = result
    ? { serverSeed: result.serverSeed, serverSeedHash, clientSeed: roundSeed.clientSeed, nonce: roundSeed.nonce }
    : phase !== "idle" ? { serverSeedHash, clientSeed: roundSeed.clientSeed, nonce: roundSeed.nonce } : null;

  return (
    <GameShell title="Video Poker" subtitle="Jacks or Better · Hold your cards · Draw for the payout"
      icon={LayoutGrid} iconClass="bg-rose-500/10 border-rose-500/20 text-rose-400" fair={fair}>
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Hand display */}
        <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center justify-center gap-5 min-h-[300px]">
          {phase === "idle" ? (
            <p className="text-[var(--muted)] text-sm">Place a bet and deal to get your 5 cards.</p>
          ) : (
            <>
              <div className="flex gap-2.5">
                {hand.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <PlayingCard card={c} size="lg" />
                    <button
                      onClick={() => toggleHold(i)}
                      disabled={phase !== "holding" || busy}
                      className={cn("text-xs font-bold px-3 py-1 rounded-md border transition-all w-full",
                        holds[i]
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)]",
                        phase === "holding" && "hover:border-[var(--accent)]/50 cursor-pointer")}>
                      {holds[i] ? "HELD" : "Hold"}
                    </button>
                  </div>
                ))}
              </div>
              {phase === "done" && result && (
                <ResultBanner profit={result.profit} label={result.multiplier > 0 ? `${result.label} · ${result.multiplier}×` : result.label} />
              )}
            </>
          )}
        </div>

        {/* Controls + paytable */}
        <div className="w-full lg:w-72 shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
          <div className="space-y-1 border border-[var(--border)] rounded-xl p-3">
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-2">Paytable · 9/6 Jacks or Better</p>
            {PAYTABLE.map(({ category, label }) => (
              <div key={category} className={cn("flex justify-between text-xs",
                result?.category === category && "text-[var(--accent)] font-bold")}>
                <span className={result?.category === category ? "" : "text-[var(--muted)]"}>{label}</span>
                <span className="font-bold">{videoPokerPayout(category)}×</span>
              </div>
            ))}
          </div>

          <BetInput value={betAmount} onChange={setBetAmount} disabled={phase === "holding" || busy} />

          {phase === "idle" && (
            <button onClick={deal} disabled={busy || betAmount > balance}
              className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
                "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
                "disabled:opacity-40 disabled:cursor-not-allowed")}>
              {busy ? "Dealing…" : "Deal"}
            </button>
          )}

          {phase === "holding" && (
            <button onClick={draw} disabled={busy}
              className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
                "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
                "disabled:opacity-40 disabled:cursor-not-allowed")}>
              {busy ? "Drawing…" : "Draw"}
            </button>
          )}

          {phase === "done" && (
            <button onClick={reset}
              className="w-full py-3 rounded-xl font-black text-base bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99] shadow-[0_0_25px_rgba(139,92,246,0.2)] transition-all">
              Play Again
            </button>
          )}
        </div>
      </div>
    </GameShell>
  );
}
