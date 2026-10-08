import { useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AnimatedNumber } from "@/components/animations/AnimatedNumber";
import { Btn } from "@/components/common/Btn";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import { NumberField, ValueBox } from "@/components/game/NumberField";
import type { BetRow } from "@/engine/persistence/storage";
import { coinsToCents, formatCoins, formatMultiplier, payoutFor } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useInstantBet } from "@/hooks/useBetting";
import { useAppStore } from "@/store/appStore";
import { playSound } from "@/utils/feedback";
import { isValidLimboTarget, LIMBO_MAX_TARGET, LIMBO_MIN_TARGET, limboWinChance, type LimboOutcome } from "./engine";

const game = GAME_BY_ID.limbo;

export default function LimboScreen() {
  const [prefs, setPrefs] = useGamePrefs("limbo", { bet: coinsToCents(10), target: 2 });
  const { play, reveal } = useInstantBet("limbo");
  const animations = useAppStore((s) => s.settings.animations);
  const [round, setRound] = useState<{ row: BetRow; outcome: LimboOutcome; done: boolean } | null>(null);
  const busy = !!round && !round.done;

  const finish = (row: BetRow) => {
    setRound((r) => (r ? { ...r, done: true } : r));
    reveal(row);
  };

  const bet = () => {
    const row = play(prefs.bet, { target: prefs.target });
    if (!row) return;
    playSound("bet");
    const outcome = row.outcome as unknown as LimboOutcome;
    // AnimatedNumber calls onDone (→ finish) even with a 0 ms duration.
    setRound({ row, outcome, done: false });
  };

  // Count-up time grows gently with the result so huge results feel bigger.
  const duration = round ? Math.min(700, 200 + Math.log10(round.outcome.result) * 180) : 0;
  const color = !round?.done ? "text-ink" : round.outcome.win ? "text-game-win" : "text-game-loss";

  const board = (
    <View className="flex-1 items-center justify-center gap-3 px-4">
      {round ? (
        <AnimatedNumber
          key={round.row.id}
          from={1}
          to={round.outcome.result}
          duration={animations ? duration : 0}
          suffix="×"
          onDone={() => finish(round.row)}
          className={`font-display text-8xl ${color}`}
          accessibilityLabel={`Result ${formatMultiplier(round.outcome.result)}`}
        />
      ) : (
        <T variant="numXl" className="text-8xl leading-[96px] text-game-tile-raised">
          1.00×
        </T>
      )}
      {round?.done ? (
        <Animated.View entering={FadeIn.duration(120)}>
          <T variant="body" className="text-soft">
            {round.outcome.win ? "Win" : "No win"}, target was {formatMultiplier(round.outcome.target)}
          </T>
        </Animated.View>
      ) : (
        <T variant="body" className="text-soft">
          Beat {formatMultiplier(prefs.target)} to win
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
        caption={`Win pays ${formatCoins(payoutFor(prefs.bet, prefs.target))}`}
      />
      <View className="flex-row gap-3">
        <NumberField
          label="Target"
          value={prefs.target}
          onChange={(target) => setPrefs({ target })}
          min={LIMBO_MIN_TARGET}
          max={LIMBO_MAX_TARGET}
          suffix="×"
          disabled={busy}
        />
        <ValueBox label="Win chance" value={`${(limboWinChance(prefs.target) * 100).toFixed(4)}%`} />
      </View>
      <Btn label={busy ? "Rolling" : "Place bet"} size="lg" onPress={bet} disabled={busy || !isValidLimboTarget(prefs.target)} silent />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
