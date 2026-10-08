"use client";

import { useCallback, useEffect, useState } from "react";
import { Shuffle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { fetchSeeds, rotateSeeds, randomClientSeed, type SeedsView } from "@/lib/seed-client";

const SEED_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-xs">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-mono break-all text-[var(--text)]">{value}</span>
    </div>
  );
}

/**
 * The logged-in player's provably-fair seed pair: the active commitment, the
 * next server seed hash (committed before they pick a client seed), rotation,
 * and revealed past pairs to verify bets against.
 */
export function SeedPairPanel() {
  const [seeds, setSeeds] = useState<SeedsView | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // A new seed is generated after each load of the next hash, never reused:
  // the server rejects client seeds it has already seen.
  const load = useCallback(async () => {
    const s = await fetchSeeds();
    setSeeds(s);
    setDraft(randomClientSeed());
  }, []);

  useEffect(() => {
    Promise.resolve().then(load).catch(() => setMessage({ tone: "error", text: "Could not load your seeds." }));
  }, [load]);

  const rotate = async () => {
    if (!seeds) return;
    const seed = draft.trim();
    if (!SEED_PATTERN.test(seed)) {
      setMessage({ tone: "error", text: "Client seed: 1–64 letters, digits, _ . or -" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await rotateSeeds(seed, seeds.nextServerSeedHash);
      if (result.ok) {
        const parts = [seeds.active ? "Seed pair rotated. The previous server seed is revealed below." : "Seed pair activated."];
        if (result.forfeited > 0) parts.push(`${result.forfeited} open round${result.forfeited === 1 ? " was" : "s were"} forfeited.`);
        setMessage({ tone: "ok", text: parts.join(" ") });
      } else {
        setMessage({ tone: "error", text: result.error });
      }
      // Refresh either way: on a mismatch the next hash changed, and any retry
      // needs a new seed. That includes a seed the player typed themselves: the
      // server has now seen it (even though it rejected the request), so
      // re-sending it would pair it with a server seed that may have been
      // ground against it. A fresh random one replaces it.
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-[var(--text)]">Seed Pair</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Every bet is <span className="font-mono">HMAC-SHA256(server seed, client seed:nonce)</span>. The server
          committed to its seed (the hash below) before you chose your client seed, and before any bet on it, so it
          can&apos;t pick outcomes. Rotate to reveal the server seed and check past bets.
        </p>
      </div>

      {!seeds ? (
        <p className="text-xs text-[var(--muted)]">Loading…</p>
      ) : (
        <>
          <div className="space-y-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] p-3">
            {seeds.active ? (
              <>
                <Row label="Server seed hash" value={seeds.active.serverSeedHash} />
                <Row label="Client seed" value={seeds.active.clientSeed} />
                <Row label="Next nonce" value={seeds.active.nonce} />
              </>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                No active pair yet. One is activated with a random client seed on your first bet, or choose your own below.
              </p>
            )}
            <Row label="Next server hash" value={seeds.nextServerSeedHash} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text)]">
              {seeds.active ? "New client seed" : "Client seed"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={() => setDraft(randomClientSeed())}
                title="Randomize"
                className="px-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
              >
                <Shuffle size={16} />
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              Pairs with the next server seed above. Use a seed you haven&apos;t used before.
              {seeds.active && " Rotating forfeits any round still in progress."}
            </p>
            <button
              onClick={rotate}
              disabled={busy}
              className={cn("w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-1.5",
                "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                "disabled:opacity-30 disabled:cursor-not-allowed")}
            >
              <RefreshCw size={14} />
              {seeds.active ? "Rotate Seed Pair" : "Activate Seed Pair"}
            </button>
            {message && (
              <p className={cn("text-xs", message.tone === "ok" ? "text-[var(--win)]" : "text-[var(--lose)]")}>{message.text}</p>
            )}
          </div>

          {seeds.revealed.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text)]">Revealed pairs</h3>
              {seeds.revealed.map((p) => (
                <div key={p.serverSeedHash} className="space-y-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] p-3">
                  <Row label="Server seed" value={p.serverSeed} />
                  <Row label="Hash" value={p.serverSeedHash} />
                  <Row label="Client seed" value={p.clientSeed} />
                  <Row label="Bets (nonces)" value={p.nonce > 0 ? `0 – ${p.nonce - 1}` : "none"} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
