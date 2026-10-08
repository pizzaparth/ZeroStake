import { Gem } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { Btn } from "@/components/common/Btn";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import type { BetRow } from "@/engine/persistence/storage";
import { coinsToCents, formatMultiplier } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useInstantBet } from "@/hooks/useBetting";
import { useAppStore } from "@/store/appStore";
import { haptic, playSound } from "@/utils/feedback";
import {
  DIAMONDS_PAYTABLE,
  DIAMONDS_PICKS,
  DIAMONDS_TILES,
  diamondsBoard,
  diamondsHitProbabilities,
  type DiamondsOutcome,
  type GemType,
} from "./engine";

const game = GAME_BY_ID.diamonds;
const GEM_COLORS: Record<GemType, string> = {
  diamond: "#7fe7ff",
  ruby: "#ff4d5e",
  emerald: "#2ee6a6",
  sapphire: "#3d7bff",
  topaz: "#ffc21a",
};

export default function DiamondsScreen() {
  const [prefs, setPrefs] = useGamePrefs("diamonds", { bet: coinsToCents(10), picks: [] as number[] });
  const { play, reveal } = useInstantBet("diamonds");
  const animations = useAppStore((s) => s.settings.animations);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [row, setRow] = useState<BetRow | null>(null);
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const outcome = row ? (row.outcome as unknown as DiamondsOutcome) : null;
  const [pending, setPending] = useState<DiamondsOutcome | null>(null);
  const shownOutcome = outcome ?? pending;
  const board = shownOutcome ? diamondsBoard(shownOutcome.diamonds) : null;
  const probs = diamondsHitProbabilities();

  const toggle = (i: number) => {
    if (busy) return;
    haptic("select");
    setRow(null);
    setRevealed([]);
    setPending(null);
    const picks = prefs.picks.includes(i)
      ? prefs.picks.filter((p) => p !== i)
      : prefs.picks.length < DIAMONDS_PICKS
        ? [...prefs.picks, i]
        : prefs.picks;
    setPrefs({ picks });
  };

  const bet = () => {
    const r = play(prefs.bet, { picks: prefs.picks });
    if (!r) return;
    playSound("bet");
    const out = r.outcome as unknown as DiamondsOutcome;
    setRow(null);
    setPending(out);
    const done = () => {
      setRevealed(Array.from({ length: DIAMONDS_TILES }, (_, i) => i));
      setRow(r);
      setPending(null);
      setBusy(false);
      reveal(r);
    };
    if (!animations) return done();
    setBusy(true);
    setRevealed([]);
    // Reveal the player's picks first, then the rest of the board.
    const order = [...prefs.picks, ...Array.from({ length: DIAMONDS_TILES }, (_, i) => i).filter((i) => !prefs.picks.includes(i))];
    order.forEach((tile, k) =>
      timers.current.push(
        setTimeout(
          () => {
            setRevealed((v) => [...v, tile]);
            if (k < DIAMONDS_PICKS) playSound(out.diamonds.includes(tile) ? "reveal" : "tick");
            if (k === order.length - 1) timers.current.push(setTimeout(done, 100));
          },
          k < DIAMONDS_PICKS ? k * 120 : DIAMONDS_PICKS * 120 + (k - DIAMONDS_PICKS) * 20,
        ),
      ),
    );
  };

  const boardView = (
    <View className="flex-1 justify-center gap-4 p-4">
      <View className="flex-row flex-wrap justify-between gap-y-2.5">
        {Array.from({ length: DIAMONDS_TILES }, (_, i) => {
          const picked = prefs.picks.includes(i);
          const isRevealed = revealed.includes(i) && board;
          const gem = board?.[i];
          const hit = isRevealed && gem === "diamond" && picked;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={`Tile ${i + 1}${picked ? ", picked" : ""}${isRevealed && gem ? `, ${gem}` : ""}`}
              onPress={() => toggle(i)}
              className="aspect-square w-[23%]"
            >
              <View
                className={`flex-1 items-center justify-center rounded-xl border-[3px] ${hit ? "border-game-win" : picked ? "border-chip-blue" : "border-transparent"} bg-game-tile`}
              >
                {isRevealed && gem ? (
                  <Animated.View entering={animations ? ZoomIn.duration(120) : undefined} style={{ opacity: picked || gem === "diamond" ? 1 : 0.45 }}>
                    <Gem size={30} color={GEM_COLORS[gem]} />
                  </Animated.View>
                ) : (
                  <T variant="numSm">{picked ? "PICK" : ""}</T>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row justify-between gap-1">
        {DIAMONDS_PAYTABLE.map((m, h) => {
          const active = outcome?.hits === h;
          return (
            <View key={h} className={`flex-1 items-center rounded-lg py-1 ${active ? "bg-game-gold" : "bg-game-tile"}`}>
              <T variant="numSm" className={active ? "text-inv" : "text-ink"}>
                {formatMultiplier(m)}
              </T>
              <T variant="numSm" className={`text-[11px] ${active ? "text-inv" : "text-ink"}`}>
                {h}♦ {(probs[h] * 100).toFixed(1)}%
              </T>
            </View>
          );
        })}
      </View>
      {outcome ? (
        <T variant="body" className="text-soft text-center">
          {outcome.hits} diamond{outcome.hits === 1 ? "" : "s"},{" "}
          {row!.payout > row!.totalBet ? "win" : row!.payout === row!.totalBet ? "stake back" : "no win"}
        </T>
      ) : null}
    </View>
  );

  const controls = (
    <>
      <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} disabled={busy} />
      <Btn
        label={busy ? "Revealing…" : prefs.picks.length === DIAMONDS_PICKS ? "Bet" : `Pick ${DIAMONDS_PICKS - prefs.picks.length} more`}
        size="lg"
        onPress={bet}
        disabled={busy || prefs.picks.length !== DIAMONDS_PICKS}
        silent
      />
    </>
  );

  return <GameShell game={game} board={boardView} controls={controls} />;
}
