"use client";

import { useState, useCallback } from "react";
import { Castle } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { GameShell, type ProvablyFair } from "@/components/ui/GameShell";
import { ResultBanner } from "@/components/ui/ResultBanner";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { dragonTowerConfig, dragonTowerStep, type DragonTowerDifficulty } from "@/lib/game-engine";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StartResponse {
  state?: string; token?: string; serverSeedHash: string; clientSeed: string; nonce?: number;
  rows: number; cols: number; step: number; balance?: number;
}
interface ClimbResponse {
  safe: boolean; dragonCols: number[]; pickedCol: number;
  multiplier: number; currentProfit: number; profit: number;
  state: string | null; token?: string; serverSeed?: string | null; cleared: boolean; balance?: number;
}
interface CashoutResponse {
  multiplier: number; profit: number; serverSeed?: string; allDragonPositions: number[][]; balance?: number;
}

// Row revealed state: what the player picked and where the dragons were
interface RowResult { pickedCol: number; dragonCols: number[]; safe: boolean; cols: number; }

const DIFFICULTIES: DragonTowerDifficulty[] = ["easy", "medium", "hard", "expert"];

const DIFF_LABELS: Record<DragonTowerDifficulty, string> = {
  easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert",
};

// ─── Tile component ───────────────────────────────────────────────────────────

function Tile({
  state, onClick, disabled,
}: {
  state: "hidden" | "safe" | "dragon" | "picked-safe" | "picked-dragon" | "dragon-revealed";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || state !== "hidden"}
      className={cn(
        "h-10 rounded-lg flex items-center justify-center text-lg font-black border transition-all",
        "flex-1",
        state === "hidden"
          ? "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] cursor-pointer"
          : state === "safe" || state === "picked-safe"
          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 cursor-default"
          : state === "dragon" || state === "picked-dragon"
          ? "bg-red-500/20 border-red-500/40 text-red-400 cursor-default"
          : "bg-amber-500/10 border-amber-500/30 text-amber-500/50 cursor-default"
      )}
    >
      {state === "hidden" ? "?" :
       state === "picked-safe" || state === "safe" ? "🥚" :
       state === "dragon" || state === "picked-dragon" ? "🐉" :
       "·"}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Phase = "idle" | "playing" | "over";

export default function DragonTowerPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed: settingsSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [difficulty, setDifficulty] = useState<DragonTowerDifficulty>("medium");
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);

  // Playing state
  const [gameState, setGameState] = useState<string | null>(null);
  const [gameToken, setGameToken] = useState<string | null>(null);
  const [currentRow, setCurrentRow] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [currentProfit, setCurrentProfit] = useState(0);
  const [cols, setCols] = useState(3);
  const [rowResults, setRowResults] = useState<(RowResult | null)[]>(Array(9).fill(null));
  const [allDragonPositions, setAllDragonPositions] = useState<number[][] | null>(null);

  // Fair disclosure
  const [serverSeedHash, setServerSeedHash] = useState("");
  // The round's own client seed and nonce, from the start response: for a
  // logged-in player that's the seed pair's, not the local settings seed.
  const [roundSeed, setRoundSeed] = useState({ clientSeed: "", nonce: 0 });
  const [serverSeed, setServerSeed] = useState<string | null>(null);

  // Result
  const [endProfit, setEndProfit] = useState<number | null>(null);

  const startGame = useCallback(async () => {
    if (betAmount > balance || busy) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/dragon-tower/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, difficulty, clientSeed: settingsSeed }),
      });
      const data: StartResponse = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance);
      setGameState(data.state ?? null);
      setGameToken(data.token ?? null);
      setCurrentRow(0);
      setMultiplier(1);
      setCurrentProfit(0);
      setCols(data.cols);
      setRowResults(Array(9).fill(null));
      setAllDragonPositions(null);
      setServerSeedHash(data.serverSeedHash);
      setRoundSeed({ clientSeed: data.clientSeed, nonce: data.nonce ?? 0 });
      setServerSeed(null);
      setEndProfit(null);
      setPhase("playing");
    } finally {
      setBusy(false);
    }
  }, [betAmount, balance, busy, difficulty, settingsSeed, syncBalance]);

  const climb = useCallback(async (col: number) => {
    if ((!gameState && !gameToken) || busy) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/dragon-tower/climb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(gameToken ? { token: gameToken } : { state: gameState }), col }),
      });
      const data: ClimbResponse = await res.json();

      setRowResults((prev) => {
        const next = [...prev];
        next[currentRow] = { pickedCol: col, dragonCols: data.dragonCols, safe: data.safe, cols };
        return next;
      });

      if (!data.safe || data.cleared) {
        if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
        setEndProfit(data.profit);
        setServerSeed(data.serverSeed ?? null);
        setGameState(null);
        setGameToken(null);
        setPhase("over");
      } else {
        setMultiplier(data.multiplier);
        setCurrentProfit(data.currentProfit);
        setCurrentRow((r) => r + 1);
        setGameState(data.state);
        if (data.token) setGameToken(data.token);
      }
    } finally {
      setBusy(false);
    }
  }, [gameState, gameToken, busy, currentRow, cols, applyProfit, syncBalance]);

  const cashout = useCallback(async () => {
    if ((!gameState && !gameToken) || busy || currentRow === 0) return;
    setBusy(true);
    try {
      const res = await playFetch("/api/games/dragon-tower/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gameToken ? { token: gameToken } : { state: gameState }),
      });
      const data: CashoutResponse = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
      setEndProfit(data.profit);
      setServerSeed(data.serverSeed ?? null);
      setAllDragonPositions(data.allDragonPositions);
      setGameState(null);
      setGameToken(null);
      setPhase("over");
    } finally {
      setBusy(false);
    }
  }, [gameState, gameToken, busy, currentRow, applyProfit, syncBalance]);

  const reset = () => {
    setPhase("idle");
    setRowResults(Array(9).fill(null));
    setEndProfit(null);
    setServerSeed(null);
    setAllDragonPositions(null);
  };

  const fair: ProvablyFair | null = serverSeed
    ? { serverSeed, serverSeedHash, clientSeed: roundSeed.clientSeed, nonce: roundSeed.nonce }
    : phase !== "idle" ? { serverSeedHash, clientSeed: roundSeed.clientSeed, nonce: roundSeed.nonce } : null;

  const step = dragonTowerStep(difficulty);
  const cfg = dragonTowerConfig(difficulty);

  return (
    <GameShell title="Dragon Tower" subtitle="Climb 9 rows · Avoid the dragons · Cash out any time"
      icon={Castle} iconClass="bg-orange-500/10 border-orange-500/20 text-orange-400" fair={fair}>
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Tower grid */}
        <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-2">
          {Array.from({ length: 9 }, (_, i) => {
            const row = 8 - i; // render top-to-bottom visually (row 8 at top)
            const result = rowResults[row];
            const isActive = phase === "playing" && row === currentRow;
            const isPast   = phase === "playing" ? row < currentRow : result !== null;
            const isFuture = !isActive && !isPast;
            const activeCols = result ? result.cols : cols;

            return (
              <div key={row} className={cn("flex items-center gap-2",
                isActive && "relative")}>
                {/* Row label */}
                <span className={cn("text-xs font-bold w-5 text-right shrink-0",
                  isActive ? "text-[var(--accent)]" : isPast ? "text-[var(--muted)]" : "text-[var(--border)]")}>
                  {row + 1}
                </span>

                {/* Multiplier badge */}
                <span className={cn("text-[10px] font-bold w-12 text-right shrink-0",
                  isActive ? "text-[var(--accent)]" : isPast ? "text-emerald-400" : "text-[var(--border)]")}>
                  {(Math.floor(Math.pow(step, row + 1) * 1000) / 1000).toFixed(2)}×
                </span>

                {/* Tiles */}
                <div className="flex gap-1.5 flex-1">
                  {Array.from({ length: activeCols }, (_, c) => {
                    if (result) {
                      const isDragon = result.dragonCols.includes(c);
                      const isPicked = result.pickedCol === c;
                      let state: "safe" | "dragon" | "picked-safe" | "picked-dragon" | "dragon-revealed";
                      if (isPicked && isDragon) state = "picked-dragon";
                      else if (isPicked) state = "picked-safe";
                      else if (isDragon) {
                        // Show dragon only after game over OR if player hit this row's dragon
                        state = (phase === "over" || !result.safe) ? "dragon" : "dragon-revealed";
                      }
                      else state = "safe";
                      return <Tile key={c} state={state} />;
                    }
                    if (isFuture) {
                      return <Tile key={c} state="hidden" disabled />;
                    }
                    if (isActive) {
                      // After game over on current row, allDragonPositions may be set
                      const dragonCols = allDragonPositions?.[row] ?? [];
                      if (dragonCols.length > 0) {
                        const isDragon = dragonCols.includes(c);
                        return <Tile key={c} state={isDragon ? "dragon" : "safe"} disabled />;
                      }
                      return <Tile key={c} state="hidden" onClick={() => climb(c)} disabled={busy} />;
                    }
                    return <Tile key={c} state="hidden" />;
                  })}
                </div>
              </div>
            );
          })}

          {/* Profit / result strip */}
          <div className="mt-2 flex items-center justify-between px-7">
            {phase === "playing" && currentRow > 0 && (
              <p className="text-xs text-[var(--muted)]">
                Cashout value: <span className="text-emerald-400 font-bold">
                  +{(currentProfit / 100).toFixed(2)}
                </span>
              </p>
            )}
            {phase === "over" && endProfit !== null && (
              <ResultBanner profit={endProfit}
                label={endProfit > 0 ? `${multiplier.toFixed(3)}×` : "Dragon!"} />
            )}
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-full lg:w-72 shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
          {/* Difficulty selector */}
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Difficulty</label>
            <div className="grid grid-cols-2 gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button key={d} onClick={() => setDifficulty(d)} disabled={phase === "playing" || busy}
                  className={cn("py-2 rounded-lg border text-sm font-bold transition-all",
                    difficulty === d
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_14px_rgba(139,92,246,0.3)]"
                      : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]",
                    (phase === "playing" || busy) && "opacity-40 cursor-not-allowed")}>
                  {DIFF_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-[var(--muted)] space-y-0.5 border border-[var(--border)] rounded-xl p-3">
            <div className="flex justify-between">
              <span>Grid</span>
              <span className="text-[var(--text)] font-medium">9 rows × {cfg.cols} cols</span>
            </div>
            <div className="flex justify-between">
              <span>Dragons / row</span>
              <span className="text-[var(--text)] font-medium">{cfg.dragons}</span>
            </div>
            <div className="flex justify-between">
              <span>Step multiplier</span>
              <span className="text-[var(--accent)] font-bold">{step}×</span>
            </div>
            <div className="flex justify-between">
              <span>All 9 rows</span>
              <span className="text-[var(--accent)] font-bold">{(Math.floor(Math.pow(step, 9) * 100) / 100).toFixed(2)}×</span>
            </div>
          </div>

          <BetInput value={betAmount} onChange={setBetAmount} disabled={phase === "playing" || busy} />

          {phase === "idle" && (
            <button onClick={startGame} disabled={busy || betAmount > balance}
              className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
                "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
                "disabled:opacity-40 disabled:cursor-not-allowed")}>
              {busy ? "Starting…" : "Start Climb"}
            </button>
          )}

          {phase === "playing" && (
            <button onClick={cashout} disabled={busy || currentRow === 0}
              className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
                "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
                "disabled:opacity-40 disabled:cursor-not-allowed")}>
              {currentRow === 0 ? "Pick row 1 first" : `Cash Out ${multiplier.toFixed(3)}×`}
            </button>
          )}

          {phase === "over" && (
            <button onClick={reset}
              className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
                "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                "shadow-[0_0_25px_rgba(139,92,246,0.2)]")}>
              Play Again
            </button>
          )}
        </div>
      </div>
    </GameShell>
  );
}
