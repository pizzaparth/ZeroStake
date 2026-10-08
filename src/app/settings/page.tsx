"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Settings as SettingsIcon, Shuffle, Copy, Check, RotateCcw } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useBalance } from "@/context/BalanceContext";
import { cn } from "@/lib/cn";
import { SeedPairPanel } from "@/components/SeedPairPanel";

export default function SettingsPage() {
  const { clientSeed, setClientSeed, randomizeClientSeed, startingBalance, setStartingBalance, resetToDefaults } = useSettings();
  const { reset: resetBalance } = useBalance();
  const { status } = useSession();

  const [seedDraft, setSeedDraft] = useState(clientSeed);
  const [balanceDraft, setBalanceDraft] = useState((startingBalance / 100).toFixed(2));
  const [copied, setCopied] = useState(false);

  const seedDirty = seedDraft !== clientSeed;
  const balanceDirty = parseFloat(balanceDraft || "0") * 100 !== startingBalance;

  const saveSeed = () => {
    const trimmed = seedDraft.trim();
    if (trimmed) setClientSeed(trimmed);
  };

  const saveBalance = () => {
    const minor = Math.round(parseFloat(balanceDraft || "0") * 100);
    if (minor > 0) setStartingBalance(minor);
  };

  const copySeed = async () => {
    await navigator.clipboard.writeText(clientSeed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)]">
          <SettingsIcon size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--text)]">Settings</h1>
          <p className="text-sm text-[var(--muted)]">Provably-fair seed and account preferences</p>
        </div>
      </div>

      {/* Provably Fair: logged-in players get the committed seed pair; guests a local client seed. */}
      {status === "authenticated" && <SeedPairPanel />}
      {status === "unauthenticated" && (
        <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text)]">Client Seed</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Used alongside the server seed for every game&apos;s outcome. Changing it
              changes future results — it does not affect bets already placed.
            </p>
            <p className="text-xs text-[var(--muted)] mt-1.5">
              As a guest, each bet gets a fresh server seed revealed with the result: you can recompute
              outcomes, but they aren&apos;t provably fair. Log in to play on a committed seed pair.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={seedDraft}
              onChange={(e) => setSeedDraft(e.target.value)}
              placeholder="hex string"
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={copySeed}
              title="Copy current seed"
              className="px-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
            <button
              onClick={() => setSeedDraft(randomizeClientSeed())}
              title="Randomize"
              className="px-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
            >
              <Shuffle size={16} />
            </button>
          </div>

          <button
            onClick={saveSeed}
            disabled={!seedDirty || seedDraft.trim() === ""}
            className={cn("w-full py-2.5 rounded-lg font-bold text-sm transition-all",
              "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
              "disabled:opacity-30 disabled:cursor-not-allowed")}
          >
            Save Seed
          </button>
        </section>
      )}

      {/* Account */}
      <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--text)]">Starting Balance</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Applies the next time you reset your balance from the header.
          </p>
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--accent)] text-sm font-bold">$</span>
          <input
            type="number"
            min={1}
            step={0.01}
            value={balanceDraft}
            onChange={(e) => setBalanceDraft(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg pl-7 pr-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={saveBalance}
            disabled={!balanceDirty || parseFloat(balanceDraft || "0") <= 0}
            className={cn("py-2.5 rounded-lg font-bold text-sm transition-all",
              "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
              "disabled:opacity-30 disabled:cursor-not-allowed")}
          >
            Save Amount
          </button>
          <button
            onClick={resetBalance}
            title="Reset balance now to the saved starting amount"
            className="py-2.5 rounded-lg font-bold text-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={14} />
            Reset Balance Now
          </button>
        </div>
      </section>

      <button
        onClick={() => {
          const fresh = resetToDefaults();
          setSeedDraft(fresh.clientSeed);
          setBalanceDraft((fresh.startingBalance / 100).toFixed(2));
        }}
        className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
      >
        Restore all settings to defaults
      </button>
    </div>
  );
}
