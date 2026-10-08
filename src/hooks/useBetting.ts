import { useToast } from "heroui-native";
import { useCallback, useEffect, useRef, useState } from "react";

import { readSettings, writeSetting, type BetRow } from "@/engine/persistence/storage";
import { actRound, BetError, getActiveRound, playInstant, startRound } from "@/engine/wallet/transactions";
import type { Cents } from "@/engine/wallet/money";
import type { GameId, Json } from "@/games/types";
import { useAppStore } from "@/store/appStore";
import { resultFeedback } from "@/utils/feedback";

/**
 * Bridges game screens to the atomic wallet operations.
 *
 * The DB commits the full result immediately (so a crash can't lose it), but
 * the visible balance only moves to the final value when the screen calls
 * `reveal()` after its animation — the balance never spoils the outcome.
 */
function useRevealGate() {
  // Bets whose payout is committed but not yet shown. Several can overlap (Plinko balls).
  const pending = useRef(new Set<number>());
  const refresh = useAppStore((s) => s.refresh);

  /** Shows only the stake leaving the balance; the payout waits for `reveal`. */
  const hold = useCallback((betId: number, debit: Cents) => {
    pending.current.add(betId);
    useAppStore.setState((s) => ({ balance: s.balance - debit }));
  }, []);

  const reveal = useCallback(
    (bet?: BetRow | null) => {
      if (!bet || !pending.current.delete(bet.id)) return;
      if (pending.current.size === 0) refresh();
      else useAppStore.setState((s) => ({ balance: s.balance + bet.payout, dataVersion: s.dataVersion + 1 }));
      if (bet.status === "settled") resultFeedback(bet.payout / Math.max(1, bet.baseBet), bet.totalBet / Math.max(1, bet.baseBet));
    },
    [refresh],
  );

  // Leaving mid-animation still shows the real balance.
  useEffect(
    () => () => {
      if (pending.current.size > 0) refresh();
    },
    [refresh],
  );

  return { hold, reveal };
}

function useErrorToast() {
  const { toast } = useToast();
  return useCallback(
    (e: unknown) => {
      const message = e instanceof BetError ? e.message : e instanceof Error ? e.message : "Something went wrong";
      toast.show({ variant: "danger", label: message });
    },
    [toast],
  );
}

export function useInstantBet(game: GameId) {
  const { hold, reveal } = useRevealGate();
  const showError = useErrorToast();

  const play = useCallback(
    (bet: Cents, params: Json): BetRow | null => {
      try {
        const row = playInstant(game, bet, params);
        hold(row.id, row.totalBet);
        return row;
      } catch (e) {
        showError(e);
        return null;
      }
    },
    [game, hold, showError],
  );

  return { play, reveal };
}

/** Multi-step games: start, act, resume an unfinished round after an app restart. */
export function useRound<S>(game: GameId) {
  const [bet, setBetState] = useState<BetRow | null>(() => getActiveRound(game));
  // Mirrors `bet` synchronously so an action right after `start` (same tick) sees the new round.
  const betRef = useRef(bet);
  const setBet = useCallback((row: BetRow | null) => {
    betRef.current = row;
    setBetState(row);
  }, []);
  const { reveal: revealGate, hold } = useRevealGate();
  const refresh = useAppStore((s) => s.refresh);
  const showError = useErrorToast();

  const start = useCallback(
    (amount: Cents, params: Json): BetRow | null => {
      try {
        const row = startRound(game, amount, params);
        setBet(row);
        if (row.status === "settled") hold(row.id, row.totalBet);
        else refresh();
        return row;
      } catch (e) {
        showError(e);
        return null;
      }
    },
    [game, hold, refresh, setBet, showError],
  );

  const act = useCallback(
    (action: Json): BetRow | null => {
      const bet = betRef.current;
      if (!bet || bet.status !== "active") return null;
      try {
        const before = bet.totalBet;
        const row = actRound(bet.id, action);
        setBet(row);
        if (row.status === "settled") hold(row.id, row.totalBet - before);
        else if (row.totalBet !== before) refresh();
        return row;
      } catch (e) {
        showError(e);
        return null;
      }
    },
    [hold, refresh, setBet, showError],
  );

  const reveal = useCallback(() => revealGate(betRef.current), [revealGate]);
  const clear = useCallback(() => setBet(null), [setBet]);

  return {
    bet,
    state: (bet?.status === "active" ? bet.state : null) as S | null,
    active: bet?.status === "active",
    start,
    act,
    reveal,
    clear,
  };
}

/** Remembers a game's last bet amount and options locally (SQLite settings table). */
export function useGamePrefs<P extends Record<string, unknown>>(game: GameId, defaults: P) {
  const key = `prefs.${game}`;
  const [prefs, setPrefs] = useState<P>(() => {
    try {
      const raw = readSettings()[key];
      return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<P>) } : defaults;
    } catch {
      return defaults;
    }
  });
  const update = useCallback(
    (patch: Partial<P>) =>
      setPrefs((p) => {
        const next = { ...p, ...patch };
        writeSetting(key, JSON.stringify(next));
        return next;
      }),
    [key],
  );
  return [prefs, update] as const;
}
