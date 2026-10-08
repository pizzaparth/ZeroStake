import { useEffect, useState } from "react";
import { View } from "react-native";

import { Btn } from "@/components/common/Btn";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import { PlayingCard } from "@/components/game/PlayingCard";
import { ResultBanner } from "@/components/game/ResultBanner";
import { handValue, type Card } from "@/engine/cards/deck";
import { coinsToCents } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useRound } from "@/hooks/useBetting";
import { useAppStore } from "@/store/appStore";
import { playSound } from "@/utils/feedback";
import { canDouble, canSplit, extraUnitsFor, type BlackjackAction, type BlackjackOutcome, type BlackjackState, type HandResult } from "./engine";

const game = GAME_BY_ID.blackjack;

function totalLabel(cards: Card[]): string {
  const v = handValue(cards);
  if (v.blackjack) return "BJ";
  return v.soft && v.total < 21 ? `${v.total - 10}/${v.total}` : String(v.total);
}

function Hand({
  cards,
  label,
  hideSecond,
  active,
  result,
}: {
  cards: Card[];
  label: string;
  hideSecond?: boolean;
  active?: boolean;
  result?: HandResult;
}) {
  const visible = hideSecond ? cards.slice(0, 1) : cards;
  return (
    <View className={`items-center gap-2 rounded-[18px] p-2 ${active ? "border-2 border-game-gold" : "border-2 border-transparent"}`}>
      <View className="flex-row items-center gap-2">
        <T variant="label" className="text-[12px]">
          {label}
        </T>
        <View className="rounded-full bg-game-tile px-2">
          <T variant="numSm">{totalLabel(visible)}</T>
        </View>
        {result ? (
          <View
            className={`rounded px-1.5 ${result === "win" || result === "blackjack" ? "bg-game-win" : result === "push" ? "bg-chip-gold" : "bg-game-loss"}`}
          >
            <T variant="label" className="text-[11px] text-inv">
              {result}
            </T>
          </View>
        ) : null}
      </View>
      <View className="flex-row">
        {cards.map((c, i) => (
          <View key={i} style={{ marginLeft: i === 0 ? 0 : -26 }}>
            <PlayingCard card={c} faceDown={hideSecond && i === 1} delay={i * 50} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function BlackjackScreen() {
  const [prefs, setPrefs] = useGamePrefs("blackjack", { bet: coinsToCents(10) });
  const round = useRound<BlackjackState>("blackjack");
  const balance = useAppStore((s) => s.balance);
  // Which settled bet's banner is showing (set after the reveal animation).
  const [shownId, setShownId] = useState<number | null>(null);

  const state = round.state;
  const finished = round.bet?.status === "settled" ? (round.bet.outcome as unknown as BlackjackOutcome) : null;
  const shown = !!finished && shownId === round.bet?.id;

  useEffect(() => {
    if (!finished || !round.bet) return;
    const id = round.bet.id;
    const t = setTimeout(() => {
      setShownId(id);
      round.reveal();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const act = (action: BlackjackAction) => {
    if (state && round.bet && extraUnitsFor(state, action) * round.bet.baseBet > balance) return;
    if (round.act(action)) playSound("card");
  };

  const dealer = state?.dealer ?? finished?.dealer ?? [];
  const hands = state?.hands.map((h) => ({ cards: h.cards, result: undefined as HandResult | undefined })) ?? finished?.hands ?? [];
  const affordExtra = !!round.bet && round.bet.baseBet <= balance;

  const board = (
    <View className="flex-1 justify-between py-4">
      <View className="items-center">
        {dealer.length ? (
          <Hand cards={dealer} label="Dealer" hideSecond={!!state} />
        ) : (
          <T variant="body" className="text-soft">
            Blackjack pays 3 to 2. Dealer hits soft 17.
          </T>
        )}
      </View>
      <View className="flex-row justify-center gap-2">
        {hands.map((h, i) => (
          <Hand
            key={i}
            cards={h.cards}
            label={hands.length > 1 ? `Hand ${i + 1}` : "You"}
            active={!!state && state.current === i && hands.length > 1}
            result={h.result}
          />
        ))}
      </View>
      {finished && round.bet ? (
        <ResultBanner visible={shown} multiplier={round.bet.payout / round.bet.totalBet} profit={round.bet.payout - round.bet.totalBet} />
      ) : null}
    </View>
  );

  const controls =
    round.active && state ? (
      <>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Btn label="Hit" tone="mint" onPress={() => act({ type: "hit" })} silent />
          </View>
          <View className="flex-1">
            <Btn label="Stand" tone="red" onPress={() => act({ type: "stand" })} silent />
          </View>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Btn label="Double" variant="outline" onPress={() => act({ type: "double" })} disabled={!canDouble(state) || !affordExtra} silent />
          </View>
          <View className="flex-1">
            <Btn label="Split" variant="outline" onPress={() => act({ type: "split" })} disabled={!canSplit(state) || !affordExtra} silent />
          </View>
        </View>
        <T variant="numSm">Double and split add one more stake from your balance.</T>
      </>
    ) : (
      <>
        <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} />
        <Btn label="Deal" size="lg" onPress={() => round.start(prefs.bet, {}) && playSound("card")} silent />
      </>
    );

  return <GameShell game={game} board={board} controls={controls} />;
}
