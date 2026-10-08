import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, FadeIn, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Btn } from "@/components/common/Btn";
import { Segmented } from "@/components/common/Segmented";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import type { BetRow } from "@/engine/persistence/storage";
import { coinsToCents, formatCoins, formatMultiplier, payoutFor } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useInstantBet } from "@/hooks/useBetting";
import { useAppStore } from "@/store/appStore";
import { playSound } from "@/utils/feedback";
import { FLIP_MAX_STREAK, flipMultiplier, type CoinSide, type FlipOutcome } from "./engine";

const game = GAME_BY_ID.flip;
const FLIP_MS = 340;

function Coin({ turns }: { turns: { value: number } }) {
  // Even half-turns show heads, odd show tails.
  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${turns.value * 180}deg` }],
    backfaceVisibility: "hidden",
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${turns.value * 180 + 180}deg` }],
    backfaceVisibility: "hidden",
  }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -interpolate(Math.sin((turns.value % 1) * Math.PI), [0, 1], [0, 30]) }] }));
  return (
    <Animated.View style={[{ width: 150, height: 150 }, lift]}>
      <Animated.View className="absolute inset-0 items-center justify-center rounded-full border-[10px] border-[#c7900a] bg-chip-gold" style={front}>
        <T variant="numXl" className="text-inv">
          H
        </T>
      </Animated.View>
      <Animated.View className="absolute inset-0 items-center justify-center rounded-full border-[10px] border-[#2350b8] bg-chip-blue" style={back}>
        <T variant="numXl" className="text-inv">
          T
        </T>
      </Animated.View>
    </Animated.View>
  );
}

export default function FlipScreen() {
  const [prefs, setPrefs] = useGamePrefs("flip", { bet: coinsToCents(10), side: "heads" as CoinSide, streak: 1 });
  const { play, reveal } = useInstantBet("flip");
  const animations = useAppStore((s) => s.settings.animations);
  const [shown, setShown] = useState<CoinSide[]>([]);
  const [row, setRow] = useState<BetRow | null>(null);
  const [busy, setBusy] = useState(false);
  const turns = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const multiplier = flipMultiplier(prefs.streak);

  const flip = () => {
    const bet = play(prefs.bet, { side: prefs.side, streak: prefs.streak });
    if (!bet) return;
    playSound("bet");
    const { flips } = bet.outcome as unknown as FlipOutcome;
    setRow(null);
    setShown([]);
    const done = () => {
      setShown(flips);
      setRow(bet);
      setBusy(false);
      reveal(bet);
    };
    if (!animations) {
      turns.value = flips.at(-1) === "tails" ? 1 : 0;
      return done();
    }
    setBusy(true);
    // Stop at the first miss: later flips don't matter once the streak breaks.
    const visible = flips.slice(0, Math.max(1, flips.findIndex((f) => f !== prefs.side) + 1 || flips.length));
    visible.forEach((f, i) => {
      timers.current.push(
        setTimeout(() => {
          const current = Math.round(turns.value);
          const isTails = current % 2 === 1;
          // Four half-turns, plus one if the face has to change.
          const target = current + 4 + ((f === "tails") !== isTails ? 1 : 0);
          turns.value = withTiming(target, { duration: FLIP_MS - 80, easing: Easing.out(Easing.quad) });
          timers.current.push(
            setTimeout(() => {
              playSound("tick");
              setShown((s) => [...s, f]);
              if (i === visible.length - 1) done();
            }, FLIP_MS - 60),
          );
        }, i * FLIP_MS),
      );
    });
  };

  const win = row ? (row.outcome as unknown as FlipOutcome).win : null;

  const board = (
    <View className="flex-1 items-center justify-center gap-6 p-4">
      <Coin turns={turns} />
      <View className="flex-row flex-wrap justify-center gap-1.5">
        {Array.from({ length: prefs.streak }, (_, i) => {
          const f = shown[i];
          const ok = f === prefs.side;
          return (
            <View
              key={i}
              className={`h-9 w-9 items-center justify-center rounded-full ${f ? (ok ? "bg-game-win" : "bg-game-loss") : "bg-game-tile"}`}
            >
              <T variant="numSm" className={f ? "text-inv" : "text-ink"}>
                {f ? (f === "heads" ? "H" : "T") : i + 1}
              </T>
            </View>
          );
        })}
      </View>
      {row ? (
        <Animated.View entering={FadeIn.duration(120)}>
          <T variant="body" className="text-soft">
            {win ? `Win, ${formatMultiplier(row.multiplier)}` : "No win, the streak broke"}
          </T>
        </Animated.View>
      ) : (
        <T variant="body" className="text-soft">
          {prefs.streak} {prefs.side} in a row to win
        </T>
      )}
    </View>
  );

  const controls = (
    <>
      <BetInput
        value={prefs.bet}
        onChange={(b) => setPrefs({ bet: b })}
        disabled={busy}
        caption={`Win pays ${formatCoins(payoutFor(prefs.bet, multiplier))}`}
      />
      <Segmented
        accessibilityLabel="Side"
        value={prefs.side}
        options={[
          { value: "heads", label: "Heads" },
          { value: "tails", label: "Tails" },
        ]}
        onChange={(side) => setPrefs({ side })}
        disabled={busy}
      />
      <View className="flex-row items-center gap-2">
        <View className="w-14">
          <Btn label="−" size="sm" variant="outline" disabled={busy || prefs.streak <= 1} onPress={() => setPrefs({ streak: prefs.streak - 1 })} />
        </View>
        <View className="flex-1 items-center justify-center rounded-full bg-surface px-2 py-2">
          <T variant="label">
            {prefs.streak} in a row, {(0.5 ** prefs.streak * 100).toFixed(2)}% chance
          </T>
          <T variant="num" className="font-body-bold text-lg">
            {formatMultiplier(multiplier)}
          </T>
        </View>
        <View className="w-14">
          <Btn
            label="+"
            size="sm"
            variant="outline"
            disabled={busy || prefs.streak >= FLIP_MAX_STREAK}
            onPress={() => setPrefs({ streak: prefs.streak + 1 })}
          />
        </View>
      </View>
      <Btn label={busy ? "Flipping" : "Flip coin"} size="lg" onPress={flip} disabled={busy} silent />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
