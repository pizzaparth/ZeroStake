"use client";

import { useState, useCallback } from "react";
import { TrendingUp } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { GameShell, type ProvablyFair } from "@/components/ui/GameShell";
import { ResultBanner } from "@/components/ui/ResultBanner";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { hiloOdds, hiloStep, rankLabel, suitSymbol, isRedSuit, type Card, type HiloGuess } from "@/lib/game-engine";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StartResponse {
  card: Card; state?: string; token?: string; serverSeedHash: string; clientSeed: string; nonce?: number; balance?: number;
}
interface GuessResponse {
  correct: boolean; prevCard: Card; nextCard: Card;
  multiplier: number; currentProfit: number; profit: number;
  state: string | null; token?: string; serverSeed?: string | null; balance?: number;
}
interface CashoutResponse { multiplier: number; profit: number; serverSeed?: string; balance?: number; }

// ─── Card component ───────────────────────────────────────────────────────────

function PlayingCardSmall({ card, size = "md" }: { card: Card; size?: "sm" | "md" | "lg" }) {
  const red = isRedSuit(card.suit);
  const sizeClass = size === "lg" ? "w-28 h-40 text-3xl" : size === "sm" ? "w-12 h-16 text-sm" : "w-20 h-28 text-xl";
  return (
    <div className={cn("rounded-xl border-2 flex flex-col items-center justify-center gap-1 font-black select-none",
      sizeClass,
      red ? "bg-white border-red-200 text-red-500" : "bg-white border-slate-200 text-slate-800")}>
      <span>{rankLabel(card.rank)}</span>
      <span className="text-2xl leading-none">{suitSymbol(card.suit)}</span>
    </div>
  );
}

function FaceDownCard({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-28 h-40" : size === "sm" ? "w-12 h-16" : "w-20 h-28";
  return (
    <div className={cn("rounded-xl border-2 border-[var(--border)] bg-[var(--surface-2)]", sizeClass)} />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type GamePhase = "idle" | "playing" | "over";

interface GameOverState {
  win: boolean;
  profit: number;
  /** Absent for logged-in rounds until the seed pair is rotated. */
  serverSeed?: string;
  serverSeedHash: string;
  multiplier: number;
}

export default function HiloPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed: settingsSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [busy, setBusy] = useState(false);

  // Playing state
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [history, setHistory] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<string | null>(null);
  const [gameToken, setGameToken] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [currentProfit, setCurrentProfit] = useState(0);
  const [serverSeedHash, setServerSeedHash] = useState("");
  // The round's own client seed and nonce, from the start response: for a
  // logged-in player that's the seed pair's, not the local settings seed.
  const [roundSeed, setRoundSeed] = useState({ clientSeed: "", nonce: 0 });

  // Game over state
  const [over, setOver] = useState<GameOverState | null>(null);

  const start = useCallback(async () => {
    if (betAmount > balance || busy) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/hilo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, clientSeed: settingsSeed }),
      });
      const data: StartResponse = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance);
      setCurrentCard(data.card);
      setHistory([]);
      setGameState(data.state ?? null);
      setGameToken(data.token ?? null);
      setMultiplier(1);
      setCurrentProfit(0);
      setServerSeedHash(data.serverSeedHash);
      setRoundSeed({ clientSeed: data.clientSeed, nonce: data.nonce ?? 0 });
      setOver(null);
      setPhase("playing");
    } finally {
      setBusy(false);
    }
  }, [betAmount, balance, busy, settingsSeed, syncBalance]);

  const guess = useCallback(async (g: HiloGuess) => {
    if ((!gameState && !gameToken) || !currentCard || busy) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/hilo/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(gameToken ? { token: gameToken } : { state: gameState }), guess: g }),
      });
      const data: GuessResponse = await res.json();
      setHistory((h) => [...h, data.prevCard]);
      setCurrentCard(data.nextCard);

      if (!data.correct) {
        if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
        setOver({ win: false, profit: data.profit, serverSeed: data.serverSeed ?? undefined, serverSeedHash, multiplier });
        setPhase("over");
        setGameState(null);
        setGameToken(null);
      } else {
        setMultiplier(data.multiplier);
        setCurrentProfit(data.currentProfit);
        setGameState(data.state);
        if (data.token) setGameToken(data.token);
      }
    } finally {
      setBusy(false);
    }
  }, [gameState, gameToken, currentCard, busy, applyProfit, syncBalance, serverSeedHash, multiplier]);

  const cashout = useCallback(async () => {
    if ((!gameState && !gameToken) || busy || multiplier <= 1) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/hilo/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gameToken ? { token: gameToken } : { state: gameState }),
      });
      const data: CashoutResponse = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
      setOver({ win: true, profit: data.profit, serverSeed: data.serverSeed, serverSeedHash, multiplier: data.multiplier });
      setPhase("over");
      setGameState(null);
      setGameToken(null);
    } finally {
      setBusy(false);
    }
  }, [gameState, gameToken, busy, multiplier, applyProfit, syncBalance, serverSeedHash]);

  const reset = () => { setPhase("idle"); setCurrentCard(null); setHistory([]); setOver(null); };

  const fair: ProvablyFair | null = over
    ? { serverSeed: over.serverSeed, serverSeedHash: over.serverSeedHash, clientSeed: roundSeed.clientSeed, nonce: roundSeed.nonce }
    : phase === "playing" ? { serverSeedHash, clientSeed: roundSeed.clientSeed, nonce: roundSeed.nonce } : null;

  const odds = currentCard ? hiloOdds(currentCard.rank) : null;
  const higherStep = currentCard ? hiloStep(currentCard.rank, "higher") : 0;
  const lowerStep  = currentCard ? hiloStep(currentCard.rank, "lower")  : 0;

  return (
    <GameShell title="Hilo" subtitle="Guess higher or lower · Multiply your winnings · Cash out anytime"
      icon={TrendingUp} iconClass="bg-violet-500/10 border-violet-500/20 text-violet-400" fair={fair}>
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Display panel */}
        <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center justify-center gap-6 min-h-[300px]">
          {phase === "idle" && (
            <p className="text-[var(--muted)] text-sm">Place a bet and start to reveal the first card.</p>
          )}

          {(phase === "playing" || phase === "over") && currentCard && (
            <>
              {/* History strip */}
              {history.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {history.slice(-6).map((c, i) => (
                    <PlayingCardSmall key={i} card={c} size="sm" />
                  ))}
                  <span className="text-[var(--muted)] text-xs ml-1">→</span>
                </div>
              )}

              {/* Current card */}
              <div className="flex items-center gap-4">
                <PlayingCardSmall card={currentCard} size="lg" />
                {phase === "playing" && <FaceDownCard size="lg" />}
              </div>

              {/* Multiplier */}
              {phase === "playing" && (
                <div className="text-center">
                  <p className="text-3xl font-black text-[var(--accent)]">{multiplier.toFixed(2)}×</p>
                  {multiplier > 1 && (
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      cashout = +{(currentProfit / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {phase === "over" && over && (
                <ResultBanner profit={over.profit}
                  label={over.win ? `${over.multiplier.toFixed(2)}×` : "Bust"} />
              )}
            </>
          )}
        </div>

        {/* Controls panel */}
        <div className="w-full lg:w-72 shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
          {phase === "idle" && (
            <>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={busy} />
              <button onClick={start} disabled={busy || betAmount > balance}
                className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
                  "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                  "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
                  "disabled:opacity-40 disabled:cursor-not-allowed")}>
                {busy ? "Dealing…" : "Deal Card"}
              </button>
            </>
          )}

          {phase === "playing" && odds && (
            <>
              <div className="space-y-2">
                <button onClick={() => guess("higher")} disabled={busy || higherStep === 0}
                  className={cn("w-full py-3.5 rounded-xl font-black text-base transition-all border-2",
                    "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20",
                    "disabled:opacity-30 disabled:cursor-not-allowed")}>
                  <span className="block">▲ Higher</span>
                  {higherStep > 0 && (
                    <span className="block text-xs font-medium opacity-70">
                      {odds.higher}/51 cards · {higherStep}×
                    </span>
                  )}
                </button>
                <button onClick={() => guess("lower")} disabled={busy || lowerStep === 0}
                  className={cn("w-full py-3.5 rounded-xl font-black text-base transition-all border-2",
                    "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20",
                    "disabled:opacity-30 disabled:cursor-not-allowed")}>
                  <span className="block">▼ Lower</span>
                  {lowerStep > 0 && (
                    <span className="block text-xs font-medium opacity-70">
                      {odds.lower}/51 cards · {lowerStep}×
                    </span>
                  )}
                </button>
              </div>
              <button onClick={cashout} disabled={busy || multiplier <= 1}
                className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
                  "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                  "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
                  "disabled:opacity-40 disabled:cursor-not-allowed")}>
                {multiplier > 1
                  ? `Cash Out ${multiplier.toFixed(2)}×`
                  : "Win a round first"}
              </button>
            </>
          )}

          {phase === "over" && (
            <>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={busy} />
              <button onClick={reset}
                className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
                  "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                  "shadow-[0_0_25px_rgba(139,92,246,0.2)]")}>
                Play Again
              </button>
            </>
          )}
        </div>
      </div>
    </GameShell>
  );
}
