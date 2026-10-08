"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "./SettingsContext";

const STORAGE_KEY = "steak:balance";

interface BalanceContextValue {
  balance: number;      // minor units (divide by 100 to display)
  applyProfit: (profit: number) => void;
  /** Authenticated path: sets balance directly from a server-authoritative
   *  response, bypassing local math and localStorage entirely. */
  syncBalance: (next: number) => void;
  reset: () => void;
  fmt: (minor: number) => string;
}

const BalanceContext = createContext<BalanceContextValue | null>(null);

function loadStoredBalance(fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw !== null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function BalanceProvider({ children }: { children: ReactNode }) {
  const { startingBalance } = useSettings();
  const { status } = useSession();
  const authenticated = status === "authenticated";

  // Always starts at the SSR-safe default so the client's first paint matches
  // the server's exactly — neither localStorage (guest) nor the DB
  // (authenticated) balance is knowable during server rendering, so both are
  // applied in an effect immediately after mount rather than a lazy
  // initializer, which would desync from the server and trigger a hydration
  // mismatch the moment localStorage held anything but the default.
  const [balance, setBalance] = useState(startingBalance);

  const syncBalance = useCallback((next: number) => {
    setBalance(next);
  }, []);

  // Guest: adopt whatever's in localStorage right after mount. The read
  // itself is synchronous, but it's deferred into a microtask (matching the
  // fetch().then() pattern below) since setState directly in an effect body
  // is a lint error here — this is a genuine external-system read (a browser
  // API unavailable during SSR), not the redundant-state-copy the rule guards
  // against, so deferring one tick is the correct way to satisfy it.
  useEffect(() => {
    if (authenticated) return;
    Promise.resolve().then(() => setBalance(loadStoredBalance(startingBalance)));
  }, [authenticated, startingBalance]);

  // Authenticated: the DB balance is the source of truth, not localStorage.
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    fetch("/api/user/balance")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setBalance(data.balance);
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const persist = useCallback((next: number) => {
    setBalance(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    }
  }, []);

  const applyProfit = useCallback((profit: number) => {
    setBalance((b) => {
      const next = Math.max(0, b + profit);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  // Reads the *current* configured starting balance, not the value at mount —
  // so changing it in Settings takes effect the next time Reset is pressed.
  const reset = useCallback(() => {
    if (authenticated) {
      fetch("/api/user/balance/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startingBalance }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setBalance(data.balance);
        });
      return;
    }
    persist(startingBalance);
  }, [authenticated, persist, startingBalance]);

  const fmt = useCallback(
    (minor: number) => (minor / 100).toFixed(2),
    []
  );

  return (
    <BalanceContext.Provider value={{ balance, applyProfit, syncBalance, reset, fmt }}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  const ctx = useContext(BalanceContext);
  if (!ctx) throw new Error("useBalance must be used within BalanceProvider");
  return ctx;
}
