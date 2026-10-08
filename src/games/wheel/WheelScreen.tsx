import { useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Circle, G, Path, Polygon } from "react-native-svg";

import { Btn } from "@/components/common/Btn";
import { Segmented } from "@/components/common/Segmented";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import type { BetRow } from "@/engine/persistence/storage";
import { coinsToCents, formatMultiplier } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useInstantBet } from "@/hooks/useBetting";
import { B } from "@/config/theme";
import { useAppStore } from "@/store/appStore";
import { playSound } from "@/utils/feedback";
import { WHEEL_SEGMENT_OPTIONS, wheelRing, wheelRtp, type WheelOutcome, type WheelRisk, type WheelSegments } from "./engine";

const game = GAME_BY_ID.wheel;
const SIZE = 300;
const R = SIZE / 2;

/** Game-board palette by multiplier (colour is allowed inside games). */
function colorFor(m: number): string {
  if (m === 0) return B.tile;
  if (m < 1.4) return B.sky;
  if (m < 1.6) return B.win;
  if (m < 1.75) return B.violet;
  if (m < 2) return B.gold;
  if (m < 5) return B.orange;
  return B.loss;
}

function arc(i: number, n: number): string {
  const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
  const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
  const r = R - 6;
  const x0 = R + r * Math.cos(a0);
  const y0 = R + r * Math.sin(a0);
  const x1 = R + r * Math.cos(a1);
  const y1 = R + r * Math.sin(a1);
  return `M ${R} ${R} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
}

export default function WheelScreen() {
  const [prefs, setPrefs] = useGamePrefs("wheel", { bet: coinsToCents(10), risk: "medium" as WheelRisk, segments: 30 as WheelSegments });
  const { play, reveal } = useInstantBet("wheel");
  const animations = useAppStore((s) => s.settings.animations);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState<BetRow | null>(null);
  const rotation = useSharedValue(0);

  const ring = useMemo(() => wheelRing(prefs.segments, prefs.risk), [prefs.segments, prefs.risk]);
  const legend = useMemo(() => [...new Set(ring)].sort((a, b) => a - b), [ring]);

  const finish = (row: BetRow) => {
    setSpinning(false);
    setLast(row);
    reveal(row);
  };

  const spin = () => {
    const row = play(prefs.bet, { segments: prefs.segments, risk: prefs.risk });
    if (!row) return;
    playSound("bet");
    setLast(null);
    const { segmentIndex } = row.outcome as unknown as WheelOutcome;
    const seg = 360 / prefs.segments;
    // Land the centre of the chosen segment under the top pointer.
    const base = rotation.value - (rotation.value % 360);
    const target = base + 360 * 4 + (360 - (segmentIndex + 0.5) * seg);
    if (!animations) {
      rotation.value = target;
      return finish(row);
    }
    setSpinning(true);
    rotation.value = withTiming(target, { duration: 4000, easing: Easing.bezier(0.12, 0.8, 0.2, 1) }, (done) => {
      if (done) scheduleOnRN(finish, row);
    });
  };

  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const board = (
    <View className="flex-1 items-center justify-center gap-4 p-4">
      <View style={{ width: SIZE, height: SIZE }}>
        <Animated.View style={[{ width: SIZE, height: SIZE }, wheelStyle]}>
          <Svg width={SIZE} height={SIZE}>
            <Circle cx={R} cy={R} r={R - 1} fill={B.board} />
            <G>
              {ring.map((m, i) => (
                <Path key={i} d={arc(i, ring.length)} fill={colorFor(m)} stroke={B.board} strokeWidth={2} />
              ))}
            </G>
            <Circle cx={R} cy={R} r={R * 0.64} fill={B.well} />
          </Svg>
        </Animated.View>
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <T variant="numLg" className="text-4xl">
            {last ? formatMultiplier(last.multiplier) : spinning ? "" : "Spin"}
          </T>
        </View>
        <View pointerEvents="none" className="absolute -top-2 left-0 right-0 items-center">
          <Svg width={24} height={24}>
            <Polygon points="2,0 22,0 12,20" fill={B.ink} />
          </Svg>
        </View>
      </View>
      <View className="flex-row flex-wrap justify-center gap-2">
        {legend.map((m) => (
          <View key={m} className="flex-row items-center gap-1.5 rounded-full bg-surface px-3 py-1">
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(m) }} />
            <T variant="numSm">{formatMultiplier(m)}</T>
          </View>
        ))}
      </View>
      <T variant="body" className="text-soft" accessibilityLiveRegion="polite">
        {last ? (last.payout > last.totalBet ? "Win" : last.payout === last.totalBet ? "Stake back" : "No win") : " "}
      </T>
    </View>
  );

  const controls = (
    <>
      <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} disabled={spinning} />
      <Segmented
        accessibilityLabel="Risk"
        value={prefs.risk}
        options={(["low", "medium", "high"] as WheelRisk[]).map((r) => ({ value: r, label: `${r} ${(wheelRtp(r) * 100).toFixed(0)}%` }))}
        onChange={(risk) => setPrefs({ risk })}
        disabled={spinning}
      />
      <Segmented
        accessibilityLabel="Segments"
        value={prefs.segments}
        options={WHEEL_SEGMENT_OPTIONS.map((s) => ({ value: s, label: String(s) }))}
        onChange={(segments) => setPrefs({ segments })}
        disabled={spinning}
      />
      <Btn label={spinning ? "Spinning" : "Spin the wheel"} size="lg" onPress={spin} disabled={spinning} silent />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
