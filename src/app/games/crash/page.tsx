"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";
import { ServerSeedRow } from "@/components/ui/GameShell";

type Phase = "idle" | "betting" | "flying" | "crashed" | "cashedout";

interface RoundResult {
  crashPoint: number;
  cashedOutAt: number | null;
  profit: number;
  win: boolean;
  /** Absent for logged-in rounds until the seed pair is rotated. */
  serverSeed?: string;
  clientSeed: string;
  nonce?: number;
  balance?: number;
}

const TICK_MS = 50;

function calcMultiplier(elapsedMs: number): number {
  // e^(0.00006 * elapsed) — approaches crash point exponentially
  return Math.floor(Math.pow(Math.E, 0.00006 * elapsedMs) * 100) / 100;
}

export default function CrashPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [phase, setPhase] = useState<Phase>("idle");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const crashPointRef = useRef<number>(1);
  const gameStateRef = useRef<string>("");
  const gameTokenRef = useRef<string | null>(null);
  const betAmountRef = useRef<number>(betAmount);

  useEffect(() => { betAmountRef.current = betAmount; }, [betAmount]);

  const stopTicker = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  const startRound = useCallback(async () => {
    if (betAmount > balance || phase === "flying") return;
    setPhase("betting");
    setResult(null);
    setMultiplier(1.0);
    setCrashPoint(null);

    try {
      const res = await playFetch("/api/games/crash/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", betAmount, clientSeed }),
      });
      const data = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance);
      gameStateRef.current = data.state ?? "";
      gameTokenRef.current = data.token ?? null;
      crashPointRef.current = data.crashPoint;

      // Short betting countdown then go
      setTimeout(() => {
        setPhase("flying");
        startTimeRef.current = Date.now();

        tickRef.current = setInterval(() => {
          const elapsed = Date.now() - startTimeRef.current;
          const m = calcMultiplier(elapsed);
          setMultiplier(m);

          if (m >= crashPointRef.current) {
            stopTicker();
            setMultiplier(crashPointRef.current);
            setCrashPoint(crashPointRef.current);
            setPhase("crashed");
            setHistory((h) => [crashPointRef.current, ...h].slice(0, 15));

            if (gameTokenRef.current) {
              // Authenticated: settle the bust server-side too, so the
              // GameSession gets recorded and the round row is cleaned up —
              // the bet was already reserved at start, so balance itself
              // doesn't change further here.
              playFetch("/api/games/crash/round", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "cashout",
                  token: gameTokenRef.current,
                  bust: true,
                }),
              })
                .then((r) => r.json())
                .then((data: RoundResult) => {
                  if (data.balance !== undefined) syncBalance(data.balance);
                  setResult(data);
                });
            } else {
              applyProfit(-betAmountRef.current);
              setResult({
                crashPoint: crashPointRef.current,
                cashedOutAt: null,
                profit: -betAmountRef.current,
                win: false,
                serverSeed: "",
                clientSeed: "",
              });
            }
          }
        }, TICK_MS);
      }, 800);
    } catch {
      setPhase("idle");
    }
  }, [betAmount, balance, phase, stopTicker, applyProfit, syncBalance, clientSeed]);

  const cashout = useCallback(async () => {
    if (phase !== "flying" || (!gameStateRef.current && !gameTokenRef.current)) return;
    const cashedAt = multiplier;
    stopTicker();
    setPhase("cashedout");

    try {
      const res = await playFetch("/api/games/crash/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cashout",
          ...(gameTokenRef.current ? { token: gameTokenRef.current } : { state: gameStateRef.current }),
          cashedOutAt: cashedAt,
        }),
      });
      const data: RoundResult = await res.json();
      setCrashPoint(data.crashPoint);
      setHistory((h) => [data.crashPoint, ...h].slice(0, 15));
      setResult(data);
      if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
    } catch {
      setPhase("idle");
    }
  }, [phase, multiplier, stopTicker, applyProfit, syncBalance]);

  const resetRound = () => {
    stopTicker();
    setPhase("idle");
    setMultiplier(1.0);
    setCrashPoint(null);
  };

  const isCrashed = phase === "crashed";
  const isCashedOut = phase === "cashedout";
  const isFlying = phase === "flying";
  const isIdle = phase === "idle";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <Flame className="text-orange-400" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Crash</h1>
          <p className="text-xs text-[var(--muted)]">Cash out before it crashes · Provably fair</p>
        </div>
      </div>

      {/* Multiplier display */}
      <div className={cn(
        "relative bg-[var(--surface)] border rounded-2xl p-12 flex flex-col items-center justify-center gap-3 transition-all duration-300 min-h-[220px]",
        isCrashed && "border-[var(--lose)]/50 bg-[var(--lose)]/5",
        isCashedOut && "border-[var(--win)]/50 bg-[var(--win)]/5",
        isFlying && "border-[var(--accent)]/40",
        isIdle && "border-[var(--border)]",
      )}>
        <div className={cn(
          "text-7xl font-black tabular-nums transition-colors duration-100",
          isCrashed && "text-[var(--lose)]",
          isCashedOut && "text-[var(--win)]",
          isFlying && "text-[var(--accent)]",
          (isIdle || phase === "betting") && "text-[var(--muted)]",
        )}>
          {multiplier.toFixed(2)}×
        </div>

        {phase === "betting" && (
          <p className="text-sm text-[var(--muted)] animate-pulse">Starting in…</p>
        )}
        {isCrashed && (
          <p className="text-sm font-semibold text-[var(--lose)]">
            Crashed at {crashPoint?.toFixed(2)}×
          </p>
        )}
        {isCashedOut && result && (
          <p className="text-sm font-semibold text-[var(--win)]">
            Cashed out · +${(result.profit / 100).toFixed(2)}
          </p>
        )}
      </div>

      {/* History chips */}
      {history.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {history.map((p, i) => (
            <span
              key={i}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold border",
                p < 1.5 ? "bg-[var(--lose)]/20 border-[var(--lose)]/30 text-[var(--lose)]" :
                p < 3 ? "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]" :
                "bg-[var(--win)]/20 border-[var(--win)]/30 text-[var(--win)]"
              )}
            >
              {p.toFixed(2)}×
            </span>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
        {isFlying ? (
          <button
            onClick={cashout}
            className="w-full py-4 rounded-xl bg-[var(--win)] hover:opacity-90 text-white font-black text-xl transition-all active:scale-[0.98]"
          >
            CASH OUT {multiplier.toFixed(2)}×
          </button>
        ) : (
          <>
            <BetInput
              value={betAmount}
              onChange={setBetAmount}
              disabled={phase !== "idle"}
            />
            <button
              onClick={isIdle ? startRound : resetRound}
              disabled={phase === "betting"}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                (isCrashed || isCashedOut)
                  ? "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]"
                  : "bg-[var(--accent)] text-white hover:opacity-90"
              )}
            >
              {isCrashed || isCashedOut ? "New Round" : "Place Bet"}
            </button>
          </>
        )}
      </div>

      {result && (
        <details className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-xs text-[var(--muted)]">
          <summary className="cursor-pointer font-semibold text-[var(--text)] hover:text-[var(--accent)]">
            Provably Fair Verification
          </summary>
          <div className="mt-3 space-y-1.5 font-mono break-all">
            <div><span className="text-[var(--muted)]">Crash Point: </span><span className="text-[var(--text)]">{result.crashPoint.toFixed(2)}×</span></div>
            {result.clientSeed && <>
              <ServerSeedRow serverSeed={result.serverSeed} />
              <div><span className="text-[var(--muted)]">Client Seed: </span><span className="text-[var(--text)]">{result.clientSeed}</span></div>
              {result.nonce !== undefined && (
                <div><span className="text-[var(--muted)]">Nonce: </span><span className="text-[var(--text)]">{result.nonce}</span></div>
              )}
            </>}
          </div>
        </details>
      )}
    </div>
  );
}
