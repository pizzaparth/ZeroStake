"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { History as HistoryIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ServerSeedRow } from "@/components/ui/GameShell";

interface HistoryEntry {
  id: string;
  game: string;
  betAmount: number;
  profit: number;
  multiplier: number;
  /** Null while the bet's seed pair is still active (revealed on rotation). */
  serverSeed: string | null;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: string;
}

const GAME_LABELS: Record<string, string> = {
  dice: "Dice", limbo: "Limbo", wheel: "Wheel", flip: "Flip", keno: "Keno",
  diamonds: "Diamonds", plinko: "Plinko", mines: "Mines", hilo: "Hilo",
  dragon_tower: "Dragon Tower", blackjack: "Blackjack", video_poker: "Video Poker", crash: "Crash",
};

function fmt(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function HistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/user/history?page=${targetPage}`);
      if (!res.ok) return;
      const data: { sessions: HistoryEntry[]; hasMore: boolean } = await res.json();
      setEntries(data.sessions);
      setHasMore(data.hasMore);
      setPage(targetPage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.resolve().then(() => load(0));
  }, [status, load]);

  if (status !== "authenticated") return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)]">
          <HistoryIcon size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--text)]">Bet History</h1>
          <p className="text-sm text-[var(--muted)]">Your last resolved bets, most recent first.</p>
        </div>
      </div>

      <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading && entries.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)] text-center">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)] text-center">No bets yet — go play something.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {entries.map((e) => (
              <details key={e.id} className="group">
                <summary className="flex items-center justify-between px-5 py-3 gap-4 cursor-pointer list-none">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">{GAME_LABELS[e.game] ?? e.game}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(e.createdAt).toLocaleString()} · bet ${fmt(e.betAmount)}
                      {e.multiplier > 0 && ` · ${e.multiplier}×`}
                    </p>
                  </div>
                  <span className={cn("text-sm font-bold tabular-nums shrink-0",
                    e.profit > 0 ? "text-[var(--win)]" : e.profit < 0 ? "text-[var(--lose)]" : "text-[var(--muted)]")}>
                    {e.profit > 0 ? "+" : ""}${fmt(e.profit)}
                  </span>
                </summary>
                <div className="px-5 pb-3 space-y-1 font-mono text-[11px] break-all text-[var(--muted)]">
                  <ServerSeedRow serverSeed={e.serverSeed} />
                  <div>Hash: <span className="text-[var(--text)]">{e.serverSeedHash}</span></div>
                  <div>Client Seed: <span className="text-[var(--text)]">{e.clientSeed}</span></div>
                  <div>Nonce: <span className="text-[var(--text)]">{e.nonce}</span></div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => load(page - 1)}
            disabled={page === 0 || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Newer
          </button>
          <button
            onClick={() => load(page + 1)}
            disabled={!hasMore || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Older
          </button>
        </div>
      )}
    </div>
  );
}
