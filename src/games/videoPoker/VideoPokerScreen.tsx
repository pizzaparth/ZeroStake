import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Btn } from "@/components/common/Btn";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import { PlayingCard } from "@/components/game/PlayingCard";
import { POKER_LABELS, rankPokerHand, type PokerCategory } from "@/engine/cards/deck";
import { coinsToCents, formatMultiplier } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useRound } from "@/hooks/useBetting";
import { haptic, playSound } from "@/utils/feedback";
import { VIDEO_POKER_PAYTABLE, type VideoPokerOutcome, type VideoPokerState } from "./engine";

const game = GAME_BY_ID.videoPoker;
const ROWS = (Object.keys(VIDEO_POKER_PAYTABLE) as PokerCategory[]).filter((c) => c !== "nothing");

export default function VideoPokerScreen() {
  const [prefs, setPrefs] = useGamePrefs("videoPoker", { bet: coinsToCents(10) });
  const round = useRound<VideoPokerState>("videoPoker");
  const [holds, setHolds] = useState<boolean[]>([false, false, false, false, false]);

  const state = round.state;
  const finished = round.bet?.status === "settled" ? (round.bet.outcome as unknown as VideoPokerOutcome) : null;
  const hand = state?.hand ?? finished?.final ?? null;
  // Live hint of what the dealt hand already is (helps decide holds).
  const category = finished?.category ?? (state ? rankPokerHand(state.hand) : null);

  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => round.reveal(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const draw = () => {
    if (round.act({ type: "draw", holds })) playSound("card");
  };

  const board = (
    <View className="flex-1 justify-between p-3">
      <View className="rounded-xl bg-game-tile p-2">
        {ROWS.map((c) => {
          const active = category === c;
          return (
            <View key={c} className={`flex-row justify-between rounded px-2 py-0.5 ${active ? "bg-game-gold" : ""}`}>
              <T variant="monoSm" className={`text-[11px] ${active ? "text-black" : "text-white"}`}>
                {POKER_LABELS[c]}
              </T>
              <T variant="monoSm" className={`text-[11px] ${active ? "text-black" : "text-white"}`}>
                {VIDEO_POKER_PAYTABLE[c]}×
              </T>
            </View>
          );
        })}
      </View>
      <View className="flex-row justify-center gap-1.5">
        {(hand ?? Array(5).fill(null)).map((c, i) => (
          <Pressable
            key={`${round.bet?.id}-${i}-${c ? `${c.rank}${c.suit}` : "x"}`}
            accessibilityRole="button"
            accessibilityState={{ selected: holds[i] }}
            accessibilityLabel={`Hold card ${i + 1}`}
            disabled={!state}
            onPress={() => {
              haptic("select");
              setHolds((h) => h.map((v, j) => (j === i ? !v : v)));
            }}
            className="items-center gap-1"
          >
            <PlayingCard card={c} faceDown={!c} size="sm" delay={i * 70} highlight={state && holds[i] ? "hold" : null} />
            <T variant="label" className={`text-[9px] ${state && holds[i] ? "text-game-gold" : "text-white"}`}>
              {state ? (holds[i] ? "Held" : "Tap") : " "}
            </T>
          </Pressable>
        ))}
      </View>
      <T variant="label" className="text-center" accessibilityLiveRegion="polite">
        {finished
          ? `${finished.label} · ${formatMultiplier(VIDEO_POKER_PAYTABLE[finished.category])}`
          : category
            ? `Dealt: ${POKER_LABELS[category]}`
            : "Jacks or Better · 9/6"}
      </T>
    </View>
  );

  const controls = state ? (
    <>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Btn label="Hold none" variant="outline" size="sm" onPress={() => setHolds([false, false, false, false, false])} />
        </View>
        <View className="flex-1">
          <Btn label="Hold all" variant="outline" size="sm" onPress={() => setHolds([true, true, true, true, true])} />
        </View>
      </View>
      <Btn label="Draw" size="lg" onPress={draw} silent />
    </>
  ) : (
    <>
      <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} />
      <Btn
        label="Deal"
        size="lg"
        onPress={() => {
          setHolds([false, false, false, false, false]);
          if (round.start(prefs.bet, {})) playSound("card");
        }}
        silent
      />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
