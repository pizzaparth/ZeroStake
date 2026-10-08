import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { Btn } from "@/components/common/Btn";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import type { BetRow } from "@/engine/persistence/storage";
import { secureRandomBytes } from "@/engine/rng/secureRandom";
import { coinsToCents, formatMultiplier } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useInstantBet } from "@/hooks/useBetting";
import { useAppStore } from "@/store/appStore";
import { haptic, playSound } from "@/utils/feedback";
import type { KenoOutcome } from "./engine";
import { KENO_MAX_PICKS, KENO_TABLES, KENO_TILES } from "./payouts";

const game = GAME_BY_ID.keno;
const DRAW_MS = 300;

/** Random picks for convenience only — they don't influence the draw, which comes from the seeds. */
function randomPicks(count: number): number[] {
  const pool = Array.from({ length: KENO_TILES }, (_, i) => i + 1);
  const bytes = secureRandomBytes(count * 2);
  const picks: number[] = [];
  for (let i = 0; i < count; i++) {
    const j = ((bytes[i * 2] << 8) | bytes[i * 2 + 1]) % pool.length;
    picks.push(pool.splice(j, 1)[0]);
  }
  return picks;
}

export default function KenoScreen() {
  const [prefs, setPrefs] = useGamePrefs("keno", { bet: coinsToCents(10), picks: [] as number[] });
  const { play, reveal } = useInstantBet("keno");
  const animations = useAppStore((s) => s.settings.animations);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [row, setRow] = useState<BetRow | null>(null);
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const picks = prefs.picks;
  const table = picks.length ? KENO_TABLES[picks.length] : [];
  const hits = drawn.filter((d) => picks.includes(d)).length;

  const toggle = (n: number) => {
    if (busy) return;
    setRow(null);
    setDrawn([]);
    haptic("select");
    if (picks.includes(n)) setPrefs({ picks: picks.filter((p) => p !== n) });
    else if (picks.length < KENO_MAX_PICKS) setPrefs({ picks: [...picks, n] });
  };

  const bet = () => {
    const r = play(prefs.bet, { picks });
    if (!r) return;
    playSound("bet");
    const outcome = r.outcome as unknown as KenoOutcome;
    setRow(null);
    setDrawn([]);
    const done = () => {
      setDrawn(outcome.drawn);
      setRow(r);
      setBusy(false);
      reveal(r);
    };
    if (!animations) return done();
    setBusy(true);
    outcome.drawn.forEach((n, i) =>
      timers.current.push(
        setTimeout(() => {
          setDrawn((d) => [...d, n]);
          playSound(picks.includes(n) ? "reveal" : "tick");
          if (i === outcome.drawn.length - 1) timers.current.push(setTimeout(done, 120));
        }, i * DRAW_MS),
      ),
    );
  };

  const board = (
    <View className="flex-1 justify-center gap-3 p-3">
      <View className="flex-row flex-wrap justify-between gap-y-1.5">
        {Array.from({ length: KENO_TILES }, (_, i) => i + 1).map((n) => {
          const picked = picks.includes(n);
          const isDrawn = drawn.includes(n);
          const hit = picked && isDrawn;
          const bg = hit ? "bg-game-win" : isDrawn ? "bg-[#43181f]" : picked ? "bg-chip-blue" : "bg-game-tile";
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={`Number ${n}${picked ? ", picked" : ""}${isDrawn ? ", drawn" : ""}`}
              onPress={() => toggle(n)}
              className="aspect-square w-[11.8%]"
            >
              <View className={`flex-1 items-center justify-center rounded-[18px] ${bg}`}>
                {isDrawn ? (
                  <Animated.View entering={animations ? ZoomIn.duration(120) : undefined}>
                    <T variant="num" className={`font-body-bold ${hit ? "text-inv" : "text-game-loss"}`}>
                      {n}
                    </T>
                  </Animated.View>
                ) : (
                  <T variant="num" className={picked ? "font-body-bold text-ink" : "text-ink"}>
                    {n}
                  </T>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      {picks.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
          {table.map((m, h) => (
            <View key={h} className={`min-w-12 items-center rounded-[14px] px-1.5 py-1 ${row && h === hits ? "bg-game-gold" : "bg-game-tile"}`}>
              <T variant="numSm" className={`text-[12px] ${row && h === hits ? "text-inv" : "text-ink"}`}>
                {formatMultiplier(m)}
              </T>
              <T variant="numSm" className={`text-[11px] ${row && h === hits ? "text-inv" : "text-ink"}`}>
                {h} hit{h === 1 ? "" : "s"}
              </T>
            </View>
          ))}
        </ScrollView>
      ) : (
        <T variant="body" className="text-soft text-center">
          Pick 1–10 numbers
        </T>
      )}
      {row ? (
        <T variant="body" className="text-soft text-center">
          {hits} hits, {row.payout > row.totalBet ? "win" : row.payout === row.totalBet ? "stake back" : "no win"} at{" "}
          {formatMultiplier(row.multiplier)}
        </T>
      ) : null}
    </View>
  );

  const controls = (
    <>
      <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} disabled={busy} />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Btn
            label="Auto pick"
            variant="outline"
            size="sm"
            disabled={busy}
            onPress={() => setPrefs({ picks: randomPicks(Math.max(picks.length, 5)) })}
          />
        </View>
        <View className="flex-1">
          <Btn label="Clear" variant="outline" size="sm" disabled={busy || !picks.length} onPress={() => setPrefs({ picks: [] })} />
        </View>
      </View>
      <Btn
        label={busy ? "Drawing" : picks.length ? `Play ${picks.length} numbers` : "Pick some numbers"}
        size="lg"
        onPress={bet}
        disabled={busy || !picks.length}
        silent
      />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
