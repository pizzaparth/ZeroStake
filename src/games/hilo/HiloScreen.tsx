import { ArrowDown, ArrowUp } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { Btn } from "@/components/common/Btn";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import { PlayingCard } from "@/components/game/PlayingCard";
import { ResultBanner } from "@/components/game/ResultBanner";
import { rankLabel } from "@/engine/cards/deck";
import { coinsToCents, formatCoins, formatMultiplier, payoutFor } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useRound } from "@/hooks/useBetting";
import { playSound } from "@/utils/feedback";
import {
  hiloCanSkip,
  hiloCurrentMultiplier,
  hiloNextMultiplier,
  hiloOdds,
  type HiloGuess,
  type HiloOutcome,
  type HiloState,
  type HiloStep,
} from "./engine";

const game = GAME_BY_ID.hilo;

export default function HiloScreen() {
  const [prefs, setPrefs] = useGamePrefs("hilo", { bet: coinsToCents(10) });
  const round = useRound<HiloState>("hilo");
  // Which settled bet's banner is showing (set after the reveal animation).
  const [shownId, setShownId] = useState<number | null>(null);

  const state = round.state;
  const finished = round.bet?.status === "settled" ? (round.bet.outcome as unknown as HiloOutcome) : null;
  const shown = !!finished && shownId === round.bet?.id;
  const steps: HiloStep[] = state?.steps ?? finished?.steps ?? [];
  const current = steps.at(-1)?.card ?? null;

  useEffect(() => {
    if (!finished || !round.bet) return;
    const id = round.bet.id;
    const t = setTimeout(() => {
      setShownId(id);
      round.reveal();
    }, 550);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const guess = (g: HiloGuess) => {
    const row = round.act({ type: "guess", guess: g });
    if (!row) return;
    playSound(row.status === "settled" && row.payout === 0 ? "bust" : "card");
  };

  const odds = state ? hiloOdds(state) : null;
  const multiplier = state ? hiloCurrentMultiplier(state) : 1;

  const board = (
    <View className="flex-1 justify-between py-4">
      <View className="flex-1 items-center justify-center gap-3">
        {current ? (
          <PlayingCard
            key={`${round.bet?.id}-${steps.length}`}
            card={current}
            size="lg"
            highlight={finished && !steps.at(-1)?.correct ? "loss" : null}
          />
        ) : (
          <PlayingCard card={null} faceDown size="lg" />
        )}
        {state && current ? (
          <T variant="label">
            {rankLabel(current.rank)} · {state.deck.length - state.position - 1} cards left
          </T>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
        {steps.slice(0, -1).map((s, i) => (
          <View key={i} className="items-center gap-1">
            <PlayingCard card={s.card} size="sm" />
            <T variant="monoSm" className="text-[9px]">
              {s.via === "start" ? "start" : s.via === "skip" ? "skip" : s.via === "higher" ? "▲" : "▼"}
            </T>
          </View>
        ))}
      </ScrollView>
      {finished && round.bet ? (
        <ResultBanner visible={shown} multiplier={round.bet.payout / round.bet.totalBet} profit={round.bet.payout - round.bet.totalBet} />
      ) : null}
    </View>
  );

  const controls =
    round.active && state && odds ? (
      <>
        <View className="flex-row gap-2">
          {(["higher", "lower"] as HiloGuess[]).map((g) => {
            const p = odds[g];
            const next = hiloNextMultiplier(state, g);
            return (
              <View key={g} className="flex-1 gap-1">
                <Btn
                  label={g === "higher" ? "Higher" : "Lower"}
                  icon={g === "higher" ? <ArrowUp size={16} color="#000" /> : <ArrowDown size={16} color="#000" />}
                  onPress={() => guess(g)}
                  disabled={p === 0}
                  silent
                />
                <T variant="monoSm" className="text-center text-[10px]">
                  {(p * 100).toFixed(1)}% · {next ? formatMultiplier(next) : "—"}
                </T>
              </View>
            );
          })}
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Btn
              label="Skip card"
              variant="outline"
              disabled={!hiloCanSkip(state)}
              onPress={() => round.act({ type: "skip" }) && playSound("card")}
              silent
            />
          </View>
          <View className="flex-1">
            <Btn
              label={state.correctGuesses ? `Cash ${formatCoins(payoutFor(round.bet!.baseBet, multiplier))}` : "Cash out"}
              disabled={!state.correctGuesses}
              onPress={() => round.act({ type: "cashout" }) && playSound("cashout")}
              silent
            />
          </View>
        </View>
        <T variant="monoSm">Current multiplier {formatMultiplier(multiplier)} · ties lose</T>
      </>
    ) : (
      <>
        <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} />
        <Btn label="Bet" size="lg" onPress={() => round.start(prefs.bet, {}) && playSound("card")} silent />
      </>
    );

  return <GameShell game={game} board={board} controls={controls} />;
}
