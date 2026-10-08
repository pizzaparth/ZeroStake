import { Slider } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Btn } from "@/components/common/Btn";
import { ChipCoin } from "@/components/common/ChipCoin";
import { Segmented } from "@/components/common/Segmented";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import { Readout } from "@/components/game/Readout";
import { coinsToCents, formatCoins, payoutFor } from "@/engine/wallet/money";
import { useGamePrefs, useInstantBet } from "@/hooks/useBetting";
import { GAME_BY_ID } from "@/games/registry";
import { useAppStore } from "@/store/appStore";
import { playSound } from "@/utils/feedback";
import { diceMultiplier, diceWinChance, isValidDiceParams, type DiceDirection, type DiceOutcome } from "./engine";

const game = GAME_BY_ID.dice;

export default function DiceScreen() {
  const [prefs, setPrefs] = useGamePrefs("dice", { bet: coinsToCents(10), target: 50, direction: "under" as DiceDirection });
  const { play, reveal } = useInstantBet("dice");
  const animations = useAppStore((s) => s.settings.animations);
  const [rolling, setRolling] = useState(false);
  const [last, setLast] = useState<{ outcome: DiceOutcome; multiplier: number; profit: number; id: number } | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const puck = useSharedValue(50);

  const { target, direction } = prefs;
  const chance = diceWinChance(target, direction);
  const multiplier = diceMultiplier(target, direction);
  const valid = isValidDiceParams({ target, direction });

  const finish = (row: NonNullable<ReturnType<typeof play>>) => {
    const outcome = row.outcome as unknown as DiceOutcome;
    setLast({ outcome, multiplier: row.payout / row.totalBet || 0, profit: row.payout - row.totalBet, id: row.id });
    setRolling(false);
    reveal(row);
  };

  const roll = () => {
    const row = play(prefs.bet, { target, direction });
    if (!row) return;
    const outcome = row.outcome as unknown as DiceOutcome;
    setLast(null);
    playSound("bet");
    if (!animations) return finish(row);
    setRolling(true);
    // One quick slide with a slight overshoot; the roll was decided before it starts.
    puck.set(
      withTiming(outcome.roll, { duration: 1200, easing: Easing.out(Easing.back(1.1)) }, (done) => {
        if (done) scheduleOnRN(finish, row);
      }),
    );
  };

  const puckStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (puck.value / 100) * trackWidth - 18 }] }));
  const winLeft = direction === "under" ? 0 : target;
  const winWidth = direction === "under" ? target : 100 - target;

  const board = (
    <View className="flex-1 justify-center gap-10 px-5">
      <View className="items-center">
        {last ? (
          <Animated.View key={last.id} entering={animations ? ZoomIn.duration(160) : undefined} className="items-center">
            <T variant="numXl" className={`text-8xl leading-[96px] ${last.outcome.win ? "text-game-win" : "text-game-loss"}`}>
              {last.outcome.roll.toFixed(2)}
            </T>
            <T variant="body" className="text-soft mt-1">
              {last.outcome.win ? "Win" : "No win"}, needed {direction} {target.toFixed(2)}
            </T>
          </Animated.View>
        ) : (
          <T variant="numXl" className="text-8xl leading-[96px] text-game-tile-raised">
            {rolling ? "··.··" : "50.00"}
          </T>
        )}
      </View>

      <View>
        <View className="h-5 flex-row overflow-hidden rounded-full bg-game-loss" onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
          <View className="absolute bottom-0 top-0 bg-game-win" style={{ left: `${winLeft}%`, width: `${winWidth}%` }} />
        </View>
        {trackWidth > 0 && (
          <Animated.View className="absolute -top-2" style={puckStyle}>
            <ChipCoin size={36} />
          </Animated.View>
        )}
        <View className="mt-3 flex-row justify-between">
          {[0, 25, 50, 75, 100].map((n) => (
            <T key={n} variant="numSm">
              {n}
            </T>
          ))}
        </View>
      </View>
    </View>
  );

  const controls = (
    <>
      <BetInput
        value={prefs.bet}
        onChange={(bet) => setPrefs({ bet })}
        disabled={rolling}
        caption={`Win pays ${formatCoins(payoutFor(prefs.bet, multiplier))}`}
      />
      <Segmented
        accessibilityLabel="Roll direction"
        value={direction}
        options={[
          { value: "under", label: "Roll under" },
          { value: "over", label: "Roll over" },
        ]}
        // Mirror the target so the win chance stays the same: under t ⇔ over 99.99 − t.
        onChange={(d) => setPrefs({ direction: d, target: Number((99.99 - target).toFixed(2)) })}
        disabled={rolling}
      />
      <View className="gap-2">
        <View className="flex-row justify-between">
          <T variant="label">Target</T>
          <T variant="num" className="font-body-bold">
            {target.toFixed(2)}
          </T>
        </View>
        <Slider
          value={target}
          minValue={direction === "under" ? 1 : 1.99}
          maxValue={direction === "under" ? 98 : 98.99}
          step={0.01}
          isDisabled={rolling}
          onChange={(v) => setPrefs({ target: Number((v as number).toFixed(2)) })}
          accessibilityLabel="Target"
        >
          <Slider.Track className="h-2 rounded-full bg-surface-2">
            <Slider.Fill className="bg-ink" />
            <Slider.Thumb className="h-6 w-6 rounded-full border-2 border-ink bg-page" />
          </Slider.Track>
        </Slider>
      </View>
      <View className="flex-row gap-2">
        <Readout label="Multiplier" value={`${multiplier.toFixed(4)}×`} />
        <Readout label="Win chance" value={`${(chance * 100).toFixed(2)}%`} />
      </View>
      <Btn label={rolling ? "Rolling" : "Roll dice"} size="lg" onPress={roll} disabled={rolling || !valid} silent />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
