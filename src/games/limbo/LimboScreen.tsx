import { useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AnimatedNumber } from "@/components/animations/AnimatedNumber";
import { Btn } from "@/components/common/Btn";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import { NumberField } from "@/components/game/NumberField";
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
  const duration = round ? Math.min(1400, 350 + Math.log10(round.outcome.result) * 400) : 0;
  const color = !round?.done ? "text-white" : round.outcome.win ? "text-game-win" : "text-game-loss";

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
          className={`font-mono-bold text-7xl ${color}`}
          accessibilityLabel={`Result ${formatMultiplier(round.outcome.result)}`}
        />
      ) : (
        <T variant="monoXl" className="text-7xl">
          1.00×
        </T>
      )}
      {round?.done ? (
        <Animated.View entering={FadeIn}>
          <T variant="label">
            {round.outcome.win ? "Win" : "Loss"} · target {formatMultiplier(round.outcome.target)}
          </T>
        </Animated.View>
      ) : (
        <T variant="label">Target {formatMultiplier(prefs.target)}</T>
      )}
    </View>
  );

  const controls = (
    <>
      <BetInput
        value={prefs.bet}
        onChange={(b) => setPrefs({ bet: b })}
        disabled={busy}
        caption={`Profit on win: ${formatCoins(payoutFor(prefs.bet, prefs.target) - prefs.bet)}`}
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
        <View className="flex-1 gap-1.5">
          <T variant="label">Win chance</T>
          <View className="h-11 justify-center border border-white px-3">
            <T variant="mono">{(limboWinChance(prefs.target) * 100).toFixed(4)}%</T>
          </View>
        </View>
      </View>
      <Btn label={busy ? "…" : "Bet"} size="lg" onPress={bet} disabled={busy || !isValidLimboTarget(prefs.target)} silent />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
