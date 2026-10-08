"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const STORAGE_KEY = "steak:settings";
const DEFAULT_STARTING_BALANCE = 1_000_00; // 1000.00 chips in minor units

interface StoredSettings {
  clientSeed: string;
  startingBalance: number;
}

interface SettingsContextValue {
  clientSeed: string;
  setClientSeed: (seed: string) => void;
  /** Returns the newly generated seed so callers can sync local UI state without an effect. */
  randomizeClientSeed: () => string;
  startingBalance: number;
  setStartingBalance: (amount: number) => void;
  resetToDefaults: () => StoredSettings;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Browser-safe random hex string (Web Crypto API — the engine's own
// generateClientSeed() pulls in Node's `crypto` module, which is server-only).
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function loadStored(): StoredSettings {
  if (typeof window === "undefined") {
    return { clientSeed: "", startingBalance: DEFAULT_STARTING_BALANCE };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.clientSeed === "string" && typeof parsed.startingBalance === "number") {
        return parsed;
      }
    }
  } catch {
    // fall through to fresh defaults
  }
  return { clientSeed: randomHex(8), startingBalance: DEFAULT_STARTING_BALANCE };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Lazy initializer runs once on the client's first render — no effect needed,
  // and loadStored() already returns SSR-safe defaults when window is undefined.
  const [stored, setStored] = useState<StoredSettings>(loadStored);

  const persist = useCallback((next: Partial<StoredSettings>) => {
    setStored((prev) => {
      const merged = { ...prev, ...next };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    });
  }, []);

  const setClientSeed = useCallback((seed: string) => persist({ clientSeed: seed }), [persist]);
  const randomizeClientSeed = useCallback(() => {
    const seed = randomHex(8);
    persist({ clientSeed: seed });
    return seed;
  }, [persist]);
  const setStartingBalance = useCallback((amount: number) => persist({ startingBalance: amount }), [persist]);
  const resetToDefaults = useCallback(() => {
    const fresh: StoredSettings = { clientSeed: randomHex(8), startingBalance: DEFAULT_STARTING_BALANCE };
    persist(fresh);
    return fresh;
  }, [persist]);

  return (
    <SettingsContext.Provider value={{
      clientSeed: stored.clientSeed, setClientSeed, randomizeClientSeed,
      startingBalance: stored.startingBalance, setStartingBalance, resetToDefaults,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
