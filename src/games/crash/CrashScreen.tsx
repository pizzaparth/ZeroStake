import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { Switch } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { ZoomIn, useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { AnimatedNumber } from "@/components/animations/AnimatedNumber";
import { Btn } from "@/components/common/Btn";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import { NumberField } from "@/components/game/NumberField";
import { listSettledBets } from "@/engine/persistence/storage";
import { actRound } from "@/engine/wallet/transactions";
import { floorTo } from "@/engine/probability/houseEdge";
import { coinsToCents, formatCoins, formatMultiplier, payoutFor } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useRound } from "@/hooks/useBetting";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useAppStore } from "@/store/appStore";
import { playSound } from "@/utils/feedback";
import { CRASH_GROWTH, resolveAbandonedCrash, type CrashOutcome, type CrashState } from "./engine";

const game = GAME_BY_ID.crash;

export default function CrashScreen() {
  const [prefs, setPrefs] = useGamePrefs("crash", { bet: coinsToCents(10), auto: false, autoCashout: 2 });
  const round = useRound<CrashState>("crash");
  const animations = useAppStore((s) => s.settings.animations);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<"idle" | "flying" | "crashed">("idle");
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const settledRef = useRef(false);

  // UI-thread animation state. The crash point is fixed BEFORE the curve starts.
  const elapsed = useSharedValue(0);
  const mult = useSharedValue(1);
  const crashAt = useSharedValue(1);
  const autoAt = useSharedValue(0);
  const running = useSharedValue(false);
  const autoFired = useSharedValue(false);

  const recent = useLiveQuery(() =>
    listSettledBets({ limit: 10, offset: 0, game: "crash" }).map((b) => (b.outcome as unknown as CrashOutcome).crashPoint),
  );

  // A round left running when the app closed: settle it by the documented rule.
  useEffect(() => {
    if (round.bet?.status === "active" && round.state) {
      actRound(round.bet.id, resolveAbandonedCrash(round.state));
      round.clear();
      useAppStore.getState().refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAuto = (at: number) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setCashedAt(at);
    round.act({ type: "cashout", at });
    playSound("cashout");
  };

  const onCrash = () => {
    setPhase("crashed");
    playSound(settledRef.current ? "tick" : "bust");
    if (!settledRef.current) {
      settledRef.current = true;
      round.act({ type: "bust" });
    }
  };

  // Reveal the payout only once the curve has crashed.
  useEffect(() => {
    if (phase === "crashed") round.reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useFrameCallback((frame) => {
    "worklet";
    if (!running.value) return;
    elapsed.value += frame.timeSincePreviousFrame ?? 16;
    const m = Math.exp(CRASH_GROWTH * elapsed.value);
    if (autoAt.value > 0 && !autoFired.value && m >= autoAt.value && autoAt.value <= crashAt.value) {
      autoFired.value = true;
      scheduleOnRN(onAuto, autoAt.value);
    }
    if (m >= crashAt.value) {
      mult.value = crashAt.value;
      running.value = false;
      scheduleOnRN(onCrash);
    } else mult.value = m;
  });

  const start = () => {
    const auto = prefs.auto ? prefs.autoCashout : null;
    const row = round.start(prefs.bet, { autoCashout: auto });
    if (!row || !row.state) return;
    playSound("bet");
    const st = row.state as CrashState;
    settledRef.current = false;
    setCashedAt(null);
    crashAt.set(st.crashPoint);
    autoAt.set(auto ?? 0);
    autoFired.set(false);
    elapsed.set(0);
    mult.set(1);
    setPhase("flying");
    if (!animations) {
      // Reduced motion: jump straight to the end of the curve.
      elapsed.set(Math.log(st.crashPoint) / CRASH_GROWTH);
      if (auto !== null && auto <= st.crashPoint) onAuto(auto);
      mult.set(st.crashPoint);
      onCrash();
      return;
    }
    running.set(true);
  };

  const cashout = () => {
    if (settledRef.current || phase !== "flying") return;
    const at = floorTo(mult.get(), 2);
    settledRef.current = true;
    setCashedAt(at);
    round.act({ type: "cashout", at });
    playSound("cashout");
  };

  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const { w, h } = size;
    if (!w) return p;
    const t = Math.max(elapsed.value, 1);
    const tMax = Math.max(t, 8000);
    const mMax = Math.max(2, mult.value * 1.15);
    p.moveTo(0, h);
    for (let i = 1; i <= 48; i++) {
      const ti = (t * i) / 48;
      const m = Math.min(Math.exp(CRASH_GROWTH * ti), mult.value);
      p.lineTo((ti / tMax) * w, h - ((m - 1) / (mMax - 1)) * h * 0.9);
    }
    return p;
  });

  const fill = useDerivedValue(() => {
    const p = path.value.copy();
    const last = p.getLastPt();
    p.lineTo(last.x, size.h);
    p.close();
    return p;
  });

  const crashed = phase === "crashed";
  const finished = round.bet?.status === "settled" ? round.bet : null;
  const won = crashed && cashedAt !== null;

  const board = (
    <View className="flex-1">
      <View className="flex-row gap-1 px-3 py-2">
        {recent.map((c, i) => (
          <View key={i} className={`rounded px-1.5 py-0.5 ${c >= 2 ? "bg-game-win" : "bg-game-tile"}`}>
            <T variant="monoSm" className={`text-[10px] ${c >= 2 ? "text-black" : "text-white"}`}>
              {c.toFixed(2)}
            </T>
          </View>
        ))}
      </View>
      <View className="flex-1 mx-3 mb-3" onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {size.w > 0 && (
          <Canvas style={{ width: size.w, height: size.h }}>
            <Path path={fill} color={crashed ? (won ? "rgba(43,255,136,0.18)" : "rgba(255,61,90,0.2)") : "rgba(255,200,61,0.18)"} />
            <Path path={path} style="stroke" strokeWidth={4} strokeCap="round" color={crashed ? (won ? "#2bff88" : "#ff3d5a") : "#ffc83d"} />
          </Canvas>
        )}
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <AnimatedNumber
            value={mult}
            suffix="×"
            className={`font-mono-bold text-6xl ${crashed ? (won ? "text-game-win" : "text-game-loss") : "text-white"}`}
          />
          {crashed ? (
            <Animated.View entering={ZoomIn}>
              <T variant="label" accessibilityLiveRegion="polite">
                Crashed · {won ? `cashed out ${formatMultiplier(cashedAt!)}` : "loss"}
              </T>
            </Animated.View>
          ) : cashedAt !== null ? (
            <T variant="label">Cashed out {formatMultiplier(cashedAt)}</T>
          ) : null}
        </View>
      </View>
    </View>
  );

  const flying = phase === "flying";
  const controls = flying ? (
    <Btn
      label={cashedAt !== null ? `Cashed out ${formatMultiplier(cashedAt)}` : "Cash out"}
      size="lg"
      onPress={cashout}
      disabled={cashedAt !== null}
      silent
    />
  ) : (
    <>
      <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} />
      <View className="flex-row items-end gap-3">
        <NumberField
          label="Auto cash-out"
          value={prefs.autoCashout}
          onChange={(autoCashout) => setPrefs({ autoCashout })}
          min={1.01}
          max={1_000_000}
          suffix="×"
          disabled={!prefs.auto}
          hint={prefs.auto ? `wins ${formatCoins(payoutFor(prefs.bet, prefs.autoCashout))}` : "off"}
        />
        <View className="h-11 justify-center">
          <Switch
            isSelected={prefs.auto}
            onSelectedChange={(auto) => setPrefs({ auto })}
            accessibilityLabel="Auto cash-out"
            className="border border-white"
          />
        </View>
      </View>
      {finished && crashed ? (
        <T variant="monoSm">
          Last round: crashed at {formatMultiplier((finished.outcome as unknown as CrashOutcome).crashPoint)} · {finished.payout > 0 ? "win" : "loss"}
        </T>
      ) : null}
      <Btn label="Bet" size="lg" onPress={start} silent />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
