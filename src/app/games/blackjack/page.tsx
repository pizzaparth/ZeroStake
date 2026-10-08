"use client";

import { useState, useCallback } from "react";
import { Spade } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { GameShell, type ProvablyFair } from "@/components/ui/GameShell";
import { ResultBanner } from "@/components/ui/ResultBanner";
import { PlayingCard } from "@/components/ui/PlayingCard";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { handValue, type Card, type BlackjackHand, type BlackjackAction, type HandResult } from "@/lib/game-engine";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";

interface StartResponse {
  playerCards: Card[]; dealerUpCard: Card; dealerCards?: Card[];
  state?: string | null; token?: string; serverSeedHash: string; clientSeed: string; nonce?: number;
  canDouble: boolean; canSplit: boolean; stage: "player" | "done";
  result?: HandResult; profit?: number; serverSeed?: string; balance?: number;
}
interface ActionResponse {
  hands: BlackjackHand[]; currentHandIndex: number; stage: "player" | "done";
  state: string | null; token?: string; canDouble: boolean; canSplit: boolean;
  dealerCards?: Card[]; results?: HandResult[]; profit?: number; serverSeed?: string; balance?: number;
}

const RESULT_LABEL: Record<HandResult, string> = {
  win: "Win", lose: "Lose", push: "Push", bust: "Bust", blackjack: "Blackjack!",
};

function HandDisplay({ hand, active, result, label }: { hand: BlackjackHand; active: boolean; result?: HandResult; label?: string }) {
  const v = handValue(hand.cards);
  return (
    <div className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
      active ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)]")}>
      <div className="flex gap-1.5">
        {hand.cards.map((c, i) => <PlayingCard key={i} card={c} size="md" />)}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold text-[var(--text)]">{v.total}{v.soft ? " (soft)" : ""}</span>
        {hand.doubled && <span className="text-[10px] text-amber-400 font-bold">2×</span>}
        {result && <span className={cn("text-xs font-bold",
          result === "win" || result === "blackjack" ? "text-emerald-400" :
          result === "push" ? "text-[var(--muted)]" : "text-red-400")}>{label}</span>}
      </div>
    </div>
  );
}

type Phase = "idle" | "playing" | "done";

export default function BlackjackPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed: settingsSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);

  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [hands, setHands] = useState<BlackjackHand[]>([]);
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [gameState, setGameState] = useState<string | null>(null);
  const [gameToken, setGameToken] = useState<string | null>(null);
  const [canDouble, setCanDouble] = useState(false);
  const [canSplit, setCanSplit] = useState(false);
  const [results, setResults] = useState<HandResult[] | null>(null);
  const [totalProfit, setTotalProfit] = useState<number | null>(null);

  const [serverSeedHash, setServerSeedHash] = useState("");
  // The round's own client seed and nonce, from the start response: for a
  // logged-in player that's the seed pair's, not the local settings seed.
  const [roundSeed, setRoundSeed] = useState({ clientSeed: "", nonce: 0 });
  const [serverSeed, setServerSeed] = useState<string | null>(null);

  const deal = useCallback(async () => {
    if (betAmount > balance || busy) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/blackjack/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, clientSeed: settingsSeed }),
      });
      const data: StartResponse = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance);
      setServerSeedHash(data.serverSeedHash);
      setRoundSeed({ clientSeed: data.clientSeed, nonce: data.nonce ?? 0 });

      if (data.stage === "done") {
        if (data.balance === undefined) applyProfit(data.profit!);
        setDealerCards(data.dealerCards!);
        setDealerHidden(false);
        setHands([{ cards: data.playerCards, bet: betAmount, finished: true, busted: false, doubled: false }]);
        setResults([data.result === "blackjack" ? "blackjack" : data.result!]);
        setTotalProfit(data.profit!);
        setServerSeed(data.serverSeed ?? null);
        setGameState(null);
        setGameToken(null);
        setCurrentHandIndex(0);
        setPhase("done");
      } else {
        setDealerCards([data.dealerUpCard]);
        setDealerHidden(true);
        setHands([{ cards: data.playerCards, bet: betAmount, finished: false, busted: false, doubled: false }]);
        setCanDouble(data.canDouble);
        setCanSplit(data.canSplit);
        setResults(null);
        setTotalProfit(null);
        setServerSeed(null);
        setGameState(data.state ?? null);
        setGameToken(data.token ?? null);
        setCurrentHandIndex(0);
        setPhase("playing");
      }
    } finally {
      setBusy(false);
    }
  }, [betAmount, balance, busy, applyProfit, syncBalance, settingsSeed]);

  const act = useCallback(async (action: BlackjackAction) => {
    if ((!gameState && !gameToken) || busy) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/blackjack/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(gameToken ? { token: gameToken } : { state: gameState }), action }),
      });
      const data: ActionResponse = await res.json();
      setHands(data.hands);
      setCurrentHandIndex(data.currentHandIndex);
      setCanDouble(data.canDouble);
      setCanSplit(data.canSplit);

      if (data.stage === "done") {
        if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit!);
        setDealerCards(data.dealerCards!);
        setDealerHidden(false);
        setResults(data.results!);
        setTotalProfit(data.profit!);
        setServerSeed(data.serverSeed ?? null);
        setGameState(null);
        setGameToken(null);
        setPhase("done");
      } else {
        setGameState(data.state);
        if (data.token) setGameToken(data.token);
      }
    } finally {
      setBusy(false);
    }
  }, [gameState, gameToken, busy, applyProfit, syncBalance]);

  const reset = () => {
    setPhase("idle"); setHands([]); setDealerCards([]); setResults(null); setTotalProfit(null); setServerSeed(null);
  };

  const fair: ProvablyFair | null = serverSeed
    ? { serverSeed, serverSeedHash, clientSeed: roundSeed.clientSeed, nonce: roundSeed.nonce }
    : phase !== "idle" ? { serverSeedHash, clientSeed: roundSeed.clientSeed, nonce: roundSeed.nonce } : null;

  const activeHand = hands[currentHandIndex];

  return (
    <GameShell title="Blackjack" subtitle="Hit, stand, double, or split · Beat the dealer to 21 · 3:2 blackjack"
      icon={Spade} iconClass="bg-slate-500/10 border-slate-500/20 text-slate-300" fair={fair}>
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Table display */}
        <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-6 min-h-[340px]">
          {phase === "idle" ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[var(--muted)] text-sm">Place a bet and deal to begin.</p>
            </div>
          ) : (
            <>
              {/* Dealer */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-[var(--muted)] uppercase tracking-wider">Dealer</p>
                <div className="flex gap-1.5">
                  <PlayingCard card={dealerCards[0]} size="md" />
                  {dealerHidden
                    ? <PlayingCard faceDown size="md" />
                    : dealerCards.slice(1).map((c, i) => <PlayingCard key={i} card={c} size="md" />)}
                </div>
                {!dealerHidden && (
                  <span className="text-sm font-bold text-[var(--text)]">{handValue(dealerCards).total}</span>
                )}
              </div>

              {/* Player hand(s) */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-[var(--muted)] uppercase tracking-wider">
                  {hands.length > 1 ? "Your Hands" : "Your Hand"}
                </p>
                <div className="flex gap-3 flex-wrap justify-center">
                  {hands.map((h, i) => (
                    <HandDisplay key={i} hand={h}
                      active={phase === "playing" && i === currentHandIndex}
                      result={results?.[i]}
                      label={results?.[i] ? RESULT_LABEL[results[i]] : undefined} />
                  ))}
                </div>
              </div>

              {phase === "done" && totalProfit !== null && (
                <div className="flex justify-center">
                  <ResultBanner profit={totalProfit} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="w-full lg:w-72 shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
          {phase === "idle" && (
            <>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={busy} />
              <button onClick={deal} disabled={busy || betAmount > balance}
                className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
                  "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                  "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
                  "disabled:opacity-40 disabled:cursor-not-allowed")}>
                {busy ? "Dealing…" : "Deal"}
              </button>
            </>
          )}

          {phase === "playing" && activeHand && (
            <div className="space-y-2">
              <button onClick={() => act("hit")} disabled={busy}
                className="w-full py-3 rounded-xl font-black text-base bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/50 transition-all disabled:opacity-40">
                Hit
              </button>
              <button onClick={() => act("stand")} disabled={busy}
                className="w-full py-3 rounded-xl font-black text-base bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/50 transition-all disabled:opacity-40">
                Stand
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => act("double")} disabled={busy || !canDouble}
                  className="py-2.5 rounded-xl font-bold text-sm bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  Double
                </button>
                <button onClick={() => act("split")} disabled={busy || !canSplit}
                  className="py-2.5 rounded-xl font-bold text-sm bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  Split
                </button>
              </div>
            </div>
          )}

          {phase === "done" && (
            <>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={busy} />
              <button onClick={reset}
                className="w-full py-3 rounded-xl font-black text-base bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99] shadow-[0_0_25px_rgba(139,92,246,0.2)] transition-all">
                Play Again
              </button>
            </>
          )}
        </div>
      </div>
    </GameShell>
  );
}
