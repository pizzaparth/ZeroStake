"use client";

import { useState, useCallback } from "react";
import { Dice5, ChevronDown, ChevronUp } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { getDiceMultiplier } from "@/lib/game-engine/dice";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";
import { ServerSeedRow } from "@/components/ui/GameShell";

type Direction = "over" | "under";

interface DiceResult {
  roll: number;
  win: boolean;
  multiplier: number;
  profit: number;
  /** Absent for logged-in bets until the seed pair is rotated. */
  serverSeed?: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  balance?: number;
}

// ─── Custom Dice Track ───────────────────────────────────────────────────────

function DiceTrack({
  target,
  direction,
  markerRoll,
  markerWin,
  onChange,
  disabled,
}: {
  target: number;
  direction: Direction;
  markerRoll: number | null;
  markerWin: boolean | null;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const loseLeft = direction === "over";
  const losePct = loseLeft ? target : 100 - target;
  const winPct = 100 - losePct;

  return (
    <div className="select-none">
      {/* Roll marker above track */}
      <div className="relative h-8 mb-1">
        {markerRoll !== null && (
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: `${markerRoll}%`,
              transform: "translateX(-50%)",
              transition: "left 350ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
          >
            <span
              className={cn(
                "text-xs font-black tabular-nums px-1.5 py-0.5 rounded",
                markerWin
                  ? "text-[var(--win)] bg-[var(--win)]/10"
                  : "text-[var(--lose)] bg-[var(--lose)]/10"
              )}
            >
              {markerRoll.toFixed(2)}
            </span>
            <div
              className={cn(
                "w-px h-2",
                markerWin ? "bg-[var(--win)]" : "bg-[var(--lose)]"
              )}
            />
          </div>
        )}
      </div>

      {/* Track */}
      <div className="relative h-10 rounded-xl overflow-hidden">
        {/* Lose zone */}
        <div
          className={cn(
            "absolute inset-y-0",
            loseLeft ? "left-0" : "right-0"
          )}
          style={{
            width: `${losePct}%`,
            background: loseLeft
              ? "linear-gradient(to right, rgba(239,68,68,0.35), rgba(239,68,68,0.15))"
              : "linear-gradient(to left, rgba(239,68,68,0.35), rgba(239,68,68,0.15))",
          }}
        />
        {/* Win zone */}
        <div
          className={cn(
            "absolute inset-y-0",
            loseLeft ? "right-0" : "left-0"
          )}
          style={{
            width: `${winPct}%`,
            background: loseLeft
              ? "linear-gradient(to right, rgba(34,197,94,0.15), rgba(34,197,94,0.35))"
              : "linear-gradient(to left, rgba(34,197,94,0.15), rgba(34,197,94,0.35))",
          }}
        />

        {/* Target separator */}
        <div
          className="absolute inset-y-0 z-10 flex items-center"
          style={{ left: `${target}%`, transform: "translateX(-50%)" }}
        >
          <div className="w-0.5 h-full bg-white/50" />
        </div>

        {/* Result glow marker */}
        {markerRoll !== null && (
          <div
            className="absolute inset-y-0 z-20 w-0.5"
            style={{
              left: `${markerRoll}%`,
              transform: "translateX(-50%)",
              transition: "left 350ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              background: markerWin
                ? "rgba(34,197,94,1)"
                : "rgba(239,68,68,1)",
              boxShadow: markerWin
                ? "0 0 12px 3px rgba(34,197,94,0.6)"
                : "0 0 12px 3px rgba(239,68,68,0.6)",
            }}
          />
        )}

        {/* Zone labels */}
        {loseLeft ? (
          <>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-red-400/70">LOSE</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-green-400/70">WIN</span>
          </>
        ) : (
          <>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-green-400/70">WIN</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-red-400/70">LOSE</span>
          </>
        )}

        {/* Invisible range input for dragging */}
        <input
          type="range"
          min={2}
          max={98}
          value={target}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>

      {/* Tick labels */}
      <div className="flex justify-between mt-1.5 text-[10px] text-[var(--muted)]">
        <span>0</span>
        <span className="font-bold text-[var(--text)]">{target}</span>
        <span>100</span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DicePage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<Direction>("over");
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [history, setHistory] = useState<DiceResult[]>([]);

  const winProb = direction === "over" ? (99 - target) / 100 : target / 100;
  const multiplier = getDiceMultiplier(target, direction);

  const roll = useCallback(async () => {
    if (betAmount > balance || rolling) return;
    setRolling(true);

    try {
      const res = await playFetch("/api/games/dice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, target, direction, clientSeed }),
      });
      const data: DiceResult = await res.json();
      setResult(data);
      setHistory((h) => [data, ...h].slice(0, 20));
      if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
    } finally {
      setRolling(false);
    }
  }, [betAmount, balance, target, direction, rolling, applyProfit, syncBalance, clientSeed]);

  const isWin = result?.win ?? null;

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Dice5 className="text-blue-400" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Dice</h1>
          <p className="text-xs text-[var(--muted)]">Drag the bar · Pick over or under · 1% house edge</p>
        </div>
      </div>

      {/* Big result display */}
      <div
        className={cn(
          "relative rounded-2xl border px-6 py-8 text-center overflow-hidden transition-all duration-500",
          rolling && "border-[var(--border)]",
          isWin === true && "border-[var(--win)]/40",
          isWin === false && "border-[var(--lose)]/40",
          isWin === null && "border-[var(--border)]"
        )}
        style={{
          background:
            isWin === true
              ? "radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, var(--surface) 70%)"
              : isWin === false
              ? "radial-gradient(ellipse at center, rgba(239,68,68,0.08) 0%, var(--surface) 70%)"
              : "var(--surface)",
        }}
      >
        <div
          className={cn(
            "text-7xl font-black tabular-nums transition-all duration-300",
            rolling && "animate-pulse text-[var(--muted)]",
            isWin === true && "text-[var(--win)]",
            isWin === false && "text-[var(--lose)]",
            isWin === null && "text-[var(--muted)]"
          )}
          style={
            isWin === true
              ? { textShadow: "0 0 40px rgba(34,197,94,0.4)" }
              : isWin === false
              ? { textShadow: "0 0 40px rgba(239,68,68,0.4)" }
              : {}
          }
        >
          {rolling ? "…" : result ? result.roll.toFixed(2) : "00.00"}
        </div>

        {result && !rolling && (
          <p
            className={cn(
              "mt-2 text-sm font-bold",
              result.win ? "text-[var(--win)]" : "text-[var(--lose)]"
            )}
          >
            {result.win
              ? `WIN · +$${(result.profit / 100).toFixed(2)} · ${result.multiplier}×`
              : `BUST · -$${(Math.abs(result.profit) / 100).toFixed(2)}`}
          </p>
        )}
      </div>

      {/* Track */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-5">
        <DiceTrack
          target={target}
          direction={direction}
          markerRoll={result?.roll ?? null}
          markerWin={result?.win ?? null}
          onChange={setTarget}
          disabled={rolling}
        />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Win Chance</p>
            <p className="text-base font-black text-[var(--text)]">{(winProb * 100).toFixed(2)}%</p>
          </div>
          <div className="bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Multiplier</p>
            <p className="text-base font-black text-[var(--accent)]">{multiplier}×</p>
          </div>
          <div className="bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Profit on Win</p>
            <p className="text-base font-black text-[var(--win)]">
              +${((betAmount / 100) * (multiplier - 1)).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Direction toggle */}
        <div className="flex gap-2">
          {(["over", "under"] as Direction[]).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              disabled={rolling}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all border",
                direction === d
                  ? d === "over"
                    ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    : "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                  : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
              )}
            >
              {d === "over" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              Roll {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        <BetInput value={betAmount} onChange={setBetAmount} disabled={rolling} />

        <button
          onClick={roll}
          disabled={rolling || betAmount > balance}
          className={cn(
            "w-full py-3.5 rounded-xl font-black text-base tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed",
            "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
            "shadow-[0_0_30px_rgba(139,92,246,0.25)] hover:shadow-[0_0_40px_rgba(139,92,246,0.4)]"
          )}
        >
          {rolling ? "Rolling…" : "Roll Dice"}
        </button>
      </div>

      {/* Recent bets */}
      {history.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Recent Bets</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {history.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[var(--surface-2)]">
                <span className="tabular-nums font-mono text-[var(--text)]">{r.roll.toFixed(2)}</span>
                <span className="text-[var(--muted)]">{r.multiplier}×</span>
                <span className={cn("font-bold", r.win ? "text-[var(--win)]" : "text-[var(--lose)]")}>
                  {r.win ? "+" : "-"}${(Math.abs(r.profit) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <details className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-xs">
          <summary className="cursor-pointer font-semibold text-[var(--text)] hover:text-[var(--accent)]">
            Provably Fair Verification
          </summary>
          <div className="mt-3 space-y-1.5 font-mono break-all text-[var(--muted)]">
            <ServerSeedRow serverSeed={result.serverSeed} />
            <div><span>Hash: </span><span className="text-[var(--text)]">{result.serverSeedHash}</span></div>
            <div><span>Client Seed: </span><span className="text-[var(--text)]">{result.clientSeed}</span></div>
            <div><span>Nonce: </span><span className="text-[var(--text)]">{result.nonce}</span></div>
          </div>
        </details>
      )}
    </div>
  );
}
