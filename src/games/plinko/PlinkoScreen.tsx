import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Circle } from "react-native-svg";

import { Btn } from "@/components/common/Btn";
import { Segmented } from "@/components/common/Segmented";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import type { BetRow } from "@/engine/persistence/storage";
import { coinsToCents, formatMultiplier } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useInstantBet } from "@/hooks/useBetting";
import { B, MOTION } from "@/config/theme";
import { useAppStore } from "@/store/appStore";
import { playSound } from "@/utils/feedback";
import type { PlinkoOutcome } from "./engine";
import { PLINKO_ROW_OPTIONS, plinkoTable, type PlinkoRisk, type PlinkoRows } from "./payouts";

const game = GAME_BY_ID.plinko;
const STEP_MS = 180;
const MAX_BALLS = 12;

interface Geometry {
  width: number;
  spacing: number;
  rowH: number;
  top: number;
  rows: number;
  ball: number;
}

const xAt = (g: Geometry, rights: number, row: number) => g.width / 2 + (rights - row / 2) * g.spacing;
const yAt = (g: Geometry, row: number) => g.top + row * g.rowH;

function bucketColor(i: number, n: number): string {
  // Edges hot (red), centre cool (gold), purely positional like a heat map.
  const d = Math.abs(i - n / 2) / (n / 2);
  if (d > 0.75) return B.loss;
  if (d > 0.5) return B.orange;
  if (d > 0.25) return B.gold;
  return B.win;
}

/**
 * One ball replaying a PRE-COMPUTED path. The engine already chose every
 * bounce from the seeds; this only draws it. Physics never decides money.
 */
const Ball = memo(function Ball({ g, path, onLand }: { g: Geometry; path: ("L" | "R")[]; onLand: () => void }) {
  const x = useSharedValue(xAt(g, 0, 0));
  const y = useSharedValue(g.top - g.rowH);

  useEffect(() => {
    let rights = 0;
    const xs: number[] = [];
    const ys: number[] = [];
    path.forEach((d, row) => {
      if (d === "R") rights++;
      xs.push(xAt(g, rights, row + 1));
      ys.push(yAt(g, row + 1) - g.ball / 2);
    });
    x.value = withSequence(
      withTiming(xAt(g, 0, 0), { duration: STEP_MS }),
      ...xs.map((v) => withTiming(v, { duration: STEP_MS, easing: Easing.inOut(Easing.quad) })),
    );
    y.value = withSequence(
      withTiming(yAt(g, 0) - g.ball / 2, { duration: STEP_MS, easing: Easing.in(Easing.quad) }),
      ...ys.map((v, i) =>
        i === ys.length - 1
          ? withTiming(v, { duration: STEP_MS, easing: Easing.in(Easing.quad) }, (done) => {
              if (done) scheduleOnRN(onLand);
            })
          : withTiming(v, { duration: STEP_MS, easing: Easing.bounce }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - g.ball / 2 }, { translateY: y.value - g.ball / 2 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute left-0 top-0 rounded-full bg-chip-gold"
      style={[{ width: g.ball, height: g.ball }, style]}
    />
  );
});

function Bucket({ m, color, hits }: { m: number; color: string; hits: number }) {
  const drop = useSharedValue(0);
  useEffect(() => {
    if (hits > 0) drop.value = withSequence(withTiming(6, { duration: 60 }), withSpring(0, MOTION.spring));
  }, [hits, drop]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));
  return (
    <Animated.View className="flex-1 items-center justify-center rounded-[14px] py-1.5" style={[{ backgroundColor: color }, style]}>
      <T variant="numSm" className="text-[8px] text-inv" numberOfLines={1} adjustsFontSizeToFit>
        {m >= 100 ? Math.round(m) : m}
      </T>
    </Animated.View>
  );
}

export default function PlinkoScreen() {
  const [prefs, setPrefs] = useGamePrefs("plinko", { bet: coinsToCents(10), risk: "medium" as PlinkoRisk, rows: 12 as PlinkoRows });
  const { play, reveal } = useInstantBet("plinko");
  const animations = useAppStore((s) => s.settings.animations);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [balls, setBalls] = useState<{ row: BetRow; path: ("L" | "R")[] }[]>([]);
  // Landing counts per bucket, tagged with the board they belong to.
  const [hits, setHits] = useState<{ rows: number; counts: number[] }>({ rows: 0, counts: [] });
  const [history, setHistory] = useState<{ id: number; m: number }[]>([]);

  const table = plinkoTable(prefs.rows, prefs.risk);
  const g: Geometry | null = useMemo(() => {
    if (!size.w) return null;
    const spacing = Math.min(size.w / (prefs.rows + 3), (size.h - 44) / (prefs.rows + 1.5));
    return { width: size.w, spacing, rowH: spacing, top: spacing * 0.9, rows: prefs.rows, ball: Math.max(8, spacing * 0.5) };
  }, [size, prefs.rows]);

  const bucketHits = hits.rows === prefs.rows ? hits.counts : [];

  const land = useCallback(
    (row: BetRow) => {
      const { bucket } = row.outcome as unknown as PlinkoOutcome;
      setBalls((b) => b.filter((x) => x.row.id !== row.id));
      const { rows } = row.outcome as unknown as PlinkoOutcome;
      setHits((h) => {
        const counts = h.rows === rows ? [...h.counts] : Array<number>(rows + 1).fill(0);
        counts[bucket] = (counts[bucket] ?? 0) + 1;
        return { rows, counts };
      });
      setHistory((h) => [{ id: row.id, m: row.multiplier }, ...h].slice(0, 8));
      reveal(row);
    },
    [reveal],
  );

  const drop = () => {
    const row = play(prefs.bet, { rows: prefs.rows, risk: prefs.risk });
    if (!row) return;
    playSound("bet");
    if (!animations || !g) return land(row);
    setBalls((b) => [...b, { row, path: (row.outcome as unknown as PlinkoOutcome).path }]);
  };

  const busy = balls.length > 0;

  const board = (
    <View className="flex-1 p-2">
      <View className="flex-1" onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {g ? (
          <>
            <Svg width={g.width} height={yAt(g, prefs.rows) + 4}>
              {Array.from({ length: prefs.rows }, (_, r) =>
                Array.from({ length: r + 3 }, (_, j) => (
                  <Circle
                    key={`${r}-${j}`}
                    cx={g.width / 2 + (j - 1 - r / 2) * g.spacing}
                    cy={yAt(g, r)}
                    r={Math.max(2, g.spacing * 0.12)}
                    fill={B.soft}
                  />
                )),
              )}
            </Svg>
            <View
              className="absolute flex-row gap-0.5"
              style={{ top: yAt(g, prefs.rows) + 2, left: g.width / 2 - ((prefs.rows + 1) / 2) * g.spacing, width: (prefs.rows + 1) * g.spacing }}
            >
              {table.map((m, i) => (
                <Bucket key={`${prefs.rows}-${prefs.risk}-${i}`} m={m} color={bucketColor(i, prefs.rows)} hits={bucketHits[i] ?? 0} />
              ))}
            </View>
            {balls.map((b) => (
              <Ball key={b.row.id} g={g} path={b.path} onLand={() => land(b.row)} />
            ))}
          </>
        ) : null}
        <View className="absolute right-0 top-0 gap-1">
          {history.map((h) => (
            <View key={h.id} className={`items-center rounded-full px-2 py-0.5 ${h.m >= 1 ? "bg-game-win" : "bg-game-tile"}`}>
              <T variant="numSm" className={`text-[12px] ${h.m >= 1 ? "text-inv" : "text-ink"}`}>
                {formatMultiplier(h.m)}
              </T>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const controls = (
    <>
      <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} disabled={busy} />
      <Segmented
        accessibilityLabel="Risk"
        value={prefs.risk}
        options={(["low", "medium", "high"] as PlinkoRisk[]).map((r) => ({ value: r, label: r }))}
        onChange={(risk) => setPrefs({ risk })}
        disabled={busy}
      />
      <Segmented
        accessibilityLabel="Rows"
        value={prefs.rows}
        options={PLINKO_ROW_OPTIONS.map((r) => ({ value: r, label: `${r} rows` }))}
        onChange={(rows) => setPrefs({ rows })}
        disabled={busy}
      />
      <Btn
        label={balls.length ? `Drop another (${balls.length} falling)` : "Drop ball"}
        size="lg"
        onPress={drop}
        disabled={balls.length >= MAX_BALLS}
        silent
      />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
