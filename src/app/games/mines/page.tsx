"use client";

import { useState, useCallback } from "react";
import { Grid2x2, Bomb, Star } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { getMinesMultiplier } from "@/lib/game-engine/mines";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";

type TileState = "hidden" | "safe" | "mine";

interface GameState {
  active: boolean;
  state: string | null;  // guest: opaque blob
  token: string | null;  // authenticated: server-side round id
  serverSeedHash: string;
  mineCount: number;
  tiles: TileState[];
  revealedCount: number;
  currentMultiplier: number;
  finished: boolean;
  won: boolean | null;
  minePositions: number[] | null;
  lastProfit: number | null;
}

const INITIAL: GameState = {
  active: false,
  state: null,
  token: null,
  serverSeedHash: "",
  mineCount: 3,
  tiles: Array(25).fill("hidden"),
  revealedCount: 0,
  currentMultiplier: 1,
  finished: false,
  won: null,
  minePositions: null,
  lastProfit: null,
};

export default function MinesPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [mineCount, setMineCount] = useState(3);
  const [game, setGame] = useState<GameState>(INITIAL);
  const [loading, setLoading] = useState(false);

  const startGame = useCallback(async () => {
    if (betAmount > balance || loading) return;
    setLoading(true);
    try {
      const res = await playFetch("/api/games/mines/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, mineCount, clientSeed }),
      });
      const data = await res.json();
      if (data.balance !== undefined) syncBalance(data.balance);
      setGame({
        ...INITIAL,
        active: true,
        state: data.state ?? null,
        token: data.token ?? null,
        serverSeedHash: data.serverSeedHash,
        mineCount,
      });
    } finally {
      setLoading(false);
    }
  }, [betAmount, mineCount, balance, loading, clientSeed, syncBalance]);

  const revealTile = useCallback(
    async (index: number) => {
      if (!game.active || game.tiles[index] !== "hidden" || loading) return;
      setLoading(true);
      try {
        const res = await playFetch("/api/games/mines/reveal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(game.token ? { token: game.token } : { state: game.state }),
            tileIndex: index,
            revealedCount: game.revealedCount,
          }),
        });
        const data = await res.json();

        if (data.hit) {
          const newTiles = [...game.tiles];
          newTiles[index] = "mine";
          data.minePositions.forEach((p: number) => {
            if (p !== index && newTiles[p] === "hidden") newTiles[p] = "mine";
          });
          setGame((g) => ({
            ...g,
            active: false,
            finished: true,
            won: false,
            tiles: newTiles,
            minePositions: data.minePositions,
            lastProfit: data.profit,
          }));
          if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
        } else {
          const newTiles = [...game.tiles];
          newTiles[index] = "safe";
          const newCount = game.revealedCount + 1;
          setGame((g) => ({
            ...g,
            tiles: newTiles,
            revealedCount: newCount,
            currentMultiplier: data.multiplier,
          }));
        }
      } finally {
        setLoading(false);
      }
    },
    [game, loading, applyProfit, syncBalance]
  );

  const cashout = useCallback(async () => {
    if (!game.active || game.revealedCount === 0 || loading) return;
    setLoading(true);
    try {
      const res = await playFetch("/api/games/mines/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(game.token ? { token: game.token } : { state: game.state }),
          revealedCount: game.revealedCount,
        }),
      });
      const data = await res.json();
      const newTiles = [...game.tiles];
      data.minePositions.forEach((p: number) => {
        if (newTiles[p] === "hidden") newTiles[p] = "mine";
      });
      setGame((g) => ({
        ...g,
        active: false,
        finished: true,
        won: true,
        tiles: newTiles,
        minePositions: data.minePositions,
        lastProfit: data.profit,
      }));
      if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
    } finally {
      setLoading(false);
    }
  }, [game, loading, applyProfit, syncBalance]);

  const currentProfit = game.active && game.revealedCount > 0
    ? Math.floor(betAmount * (game.currentMultiplier - 1))
    : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Grid2x2 className="text-emerald-400" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Mines</h1>
          <p className="text-xs text-[var(--muted)]">Reveal safe tiles · Cash out any time</p>
        </div>
      </div>

      {/* Status */}
      {(game.finished || game.active) && (
        <div className={cn(
          "p-4 rounded-xl border text-center font-semibold",
          game.finished && game.won && "bg-[var(--win)]/10 border-[var(--win)]/30 text-[var(--win)]",
          game.finished && !game.won && "bg-[var(--lose)]/10 border-[var(--lose)]/30 text-[var(--lose)]",
          game.active && "bg-[var(--surface)] border-[var(--border)] text-[var(--text)]",
        )}>
          {game.active && game.revealedCount === 0 && "Pick a tile to start revealing"}
          {game.active && game.revealedCount > 0 && (
            <span>
              {game.revealedCount} safe · <span className="text-[var(--accent)]">{game.currentMultiplier}×</span> · Cashout: <span className="text-[var(--win)]">+${(currentProfit / 100).toFixed(2)}</span>
            </span>
          )}
          {game.finished && game.won && `Cashed out ${game.currentMultiplier}× · +$${(game.lastProfit! / 100).toFixed(2)}`}
          {game.finished && !game.won && `Hit a mine · -$${(betAmount / 100).toFixed(2)}`}
        </div>
      )}

      {/* Grid */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
        <div className="grid grid-cols-5 gap-2">
          {game.tiles.map((tile, i) => (
            <button
              key={i}
              onClick={() => revealTile(i)}
              disabled={!game.active || tile !== "hidden" || loading}
              className={cn(
                "aspect-square rounded-xl border text-lg font-bold transition-all duration-150 flex items-center justify-center",
                tile === "hidden" &&
                  "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 active:scale-95 disabled:cursor-default disabled:hover:border-[var(--border)] disabled:hover:bg-[var(--surface-2)]",
                tile === "safe" && "bg-[var(--win)]/20 border-[var(--win)]/40",
                tile === "mine" && "bg-[var(--lose)]/20 border-[var(--lose)]/40"
              )}
            >
              {tile === "safe" && <Star size={16} className="text-[var(--win)]" />}
              {tile === "mine" && <Bomb size={16} className="text-[var(--lose)]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
        {!game.active ? (
          <>
            <div className="space-y-1">
              <label className="text-xs text-[var(--muted)] uppercase tracking-wider">
                Mines: <span className="text-[var(--text)] font-semibold">{mineCount}</span>
              </label>
              <input
                type="range" min={1} max={24} value={mineCount}
                onChange={(e) => setMineCount(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
              <div className="flex justify-between text-[10px] text-[var(--muted)]">
                <span>1 mine (low risk)</span>
                <span>24 mines (max risk)</span>
              </div>
            </div>
            <div className="text-xs text-[var(--muted)]">
              First reveal multiplier: <span className="text-[var(--accent)] font-semibold">
                {getMinesMultiplier(mineCount, 1)}×
              </span>
            </div>
            <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            <button
              onClick={startGame}
              disabled={loading || betAmount > balance}
              className="w-full py-3.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Starting…" : "Start Game"}
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Mines on board</span>
              <span className="text-[var(--lose)] font-semibold">{game.mineCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Safe tiles revealed</span>
              <span className="text-[var(--win)] font-semibold">{game.revealedCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Next multiplier</span>
              <span className="text-[var(--accent)] font-semibold">
                {getMinesMultiplier(game.mineCount, game.revealedCount + 1)}×
              </span>
            </div>
            <button
              onClick={cashout}
              disabled={game.revealedCount === 0 || loading}
              className="w-full py-3.5 rounded-xl bg-[var(--win)] hover:opacity-90 text-white font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "…" : `Cash Out ${game.currentMultiplier}× (+$${(currentProfit / 100).toFixed(2)})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
