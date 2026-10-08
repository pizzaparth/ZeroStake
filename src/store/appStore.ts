import { create } from "zustand";

import { readActiveSeedPair, readBalance, readSettings, writeSetting } from "@/engine/persistence/storage";
import type { SeedCommitment } from "@/engine/rng/types";
import { bootstrap } from "@/engine/wallet/transactions";
import type { Cents } from "@/engine/wallet/money";
import { DEFAULT_SETTINGS, parseSettings, type Settings } from "./settings";

/**
 * In-memory mirror of the SQLite state the UI renders from. SQLite stays the
 * source of truth: every mutation writes there first, then calls `refresh`.
 */
interface AppState {
  ready: boolean;
  balance: Cents;
  commitment: (SeedCommitment & { pairId: number }) | null;
  settings: Settings;
  /** Bumped after every write so history/stats screens know to re-query. */
  dataVersion: number;
  init(): void;
  refresh(): void;
  updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
}

function readCommitment(): AppState["commitment"] {
  const pair = readActiveSeedPair();
  return pair ? { pairId: pair.id, serverSeedHash: pair.serverSeedHash, clientSeed: pair.clientSeed, nonce: pair.nextNonce } : null;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  balance: 0,
  commitment: null,
  settings: DEFAULT_SETTINGS,
  dataVersion: 0,
  init() {
    if (get().ready) return;
    const settings = parseSettings(readSettings());
    bootstrap(settings.startingBalance);
    set({ ready: true, settings, balance: readBalance() ?? 0, commitment: readCommitment() });
  },
  refresh() {
    set((s) => ({ balance: readBalance() ?? 0, commitment: readCommitment(), dataVersion: s.dataVersion + 1 }));
  },
  updateSetting(key, value) {
    writeSetting(key, JSON.stringify(value));
    set((s) => ({ settings: { ...s.settings, [key]: value } }));
  },
}));

export const useSettings = () => useAppStore((s) => s.settings);
export const useBalance = () => useAppStore((s) => s.balance);
