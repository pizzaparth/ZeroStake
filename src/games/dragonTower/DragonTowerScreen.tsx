import { Egg, Flame } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Btn } from "@/components/common/Btn";
import { Segmented } from "@/components/common/Segmented";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import { Readout } from "@/components/game/Readout";
import { ResultBanner } from "@/components/game/ResultBanner";
import { RevealTile, type TileFace } from "@/components/game/RevealTile";
import { coinsToCents, formatCoins, formatMultiplier, payoutFor } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useRound } from "@/hooks/useBetting";
import { playSound } from "@/utils/feedback";
import {
  DRAGON_TOWER_DIFFICULTIES,
  DRAGON_TOWER_ROWS,
  dragonTowerMultiplier,
  type DragonTowerDifficulty,
  type DragonTowerOutcome,
  type DragonTowerState,
} from "./engine";

const game = GAME_BY_ID.dragonTower;
const DIFFICULTIES = Object.keys(DRAGON_TOWER_DIFFICULTIES) as DragonTowerDifficulty[];

export default function DragonTowerScreen() {
  const [prefs, setPrefs] = useGamePrefs("dragonTower", { bet: coinsToCents(10), difficulty: "medium" as DragonTowerDifficulty });
  const round = useRound<DragonTowerState>("dragonTower");
  // Which settled bet's banner is showing (set after the reveal animation).
  const [shownId, setShownId] = useState<number | null>(null);

  const state = round.state;
  const finished = round.bet?.status === "settled" ? (round.bet.outcome as unknown as DragonTowerOutcome) : null;
  const shown = !!finished && shownId === round.bet?.id;
  const difficulty = state?.difficulty ?? finished?.difficulty ?? prefs.difficulty;
  const { cols } = DRAGON_TOWER_DIFFICULTIES[difficulty];
  const picks = state?.picks ?? finished?.picks ?? [];
  const currentRow = round.active ? picks.length : -1;
  const cleared = round.active ? picks.length : 0;

  useEffect(() => {
    if (!finished || !round.bet) return;
    const id = round.bet.id;
    const t = setTimeout(() => {
      setShownId(id);
      round.reveal();
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const faceFor = (row: number, col: number): TileFace => {
    if (picks[row] === col) {
      if (finished && finished.dragons[row].includes(col)) return "bad";
      return "good";
    }
    if (finished) return finished.dragons[row].includes(col) ? "ghostBad" : "ghostGood";
    return "hidden";
  };

  const pickTile = (col: number) => {
    const row = round.act({ type: "pick", col });
    if (!row) return;
    const out = row.outcome as unknown as DragonTowerOutcome | null;
    const busted = row.status === "settled" && out && out.dragons[out.picks.length - 1]?.includes(col);
    playSound(busted ? "bust" : "reveal");
  };

  const board = (
    <View className="flex-1 p-3">
      <View className="flex-1 gap-1.5">
        {Array.from({ length: DRAGON_TOWER_ROWS }, (_, i) => DRAGON_TOWER_ROWS - 1 - i).map((row) => (
          <View
            key={row}
            className={`flex-1 flex-row items-stretch gap-1.5 rounded-xl p-0.5 ${row === currentRow ? "border-2 border-game-gold" : "border-2 border-transparent"}`}
          >
            <View className="w-14 justify-center">
              <T variant="numSm" className={`text-[12px] ${row < cleared ? "text-game-win" : "text-ink"}`}>
                {formatMultiplier(dragonTowerMultiplier(difficulty, row + 1))}
              </T>
            </View>
            {Array.from({ length: cols }, (_, col) => (
              <View key={col} className="flex-1">
                <RevealTile
                  aspectClass="flex-1"
                  face={faceFor(row, col)}
                  disabled={row !== currentRow}
                  onPress={() => pickTile(col)}
                  label={`Row ${row + 1}, tile ${col + 1}`}
                  good={<Egg size={18} color="#ffc21a" />}
                  bad={<Flame size={18} color="#ff4d5e" />}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
      {finished && round.bet ? (
        <ResultBanner visible={shown} multiplier={round.bet.payout / round.bet.totalBet} profit={round.bet.payout - round.bet.totalBet} />
      ) : null}
    </View>
  );

  const current = dragonTowerMultiplier(difficulty, cleared);
  const controls = round.active ? (
    <>
      <View className="flex-row gap-2">
        <Readout label="Rows cleared" value={`${cleared} / ${DRAGON_TOWER_ROWS}`} />
        <Readout label="Next row" value={formatMultiplier(dragonTowerMultiplier(difficulty, cleared + 1))} />
      </View>
      <Btn
        label={cleared === 0 ? "Pick a tile" : `Cash out ${formatCoins(payoutFor(round.bet!.baseBet, current))}`}
        size="lg"
        tone="mint"
        disabled={cleared === 0}
        onPress={() => round.act({ type: "cashout" }) && playSound("cashout")}
        silent
      />
    </>
  ) : (
    <>
      <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} />
      <View className="gap-2">
        <View className="flex-row justify-between">
          <T variant="label">Difficulty</T>
          <T variant="numSm">
            {DRAGON_TOWER_DIFFICULTIES[prefs.difficulty].cols - DRAGON_TOWER_DIFFICULTIES[prefs.difficulty].dragons}/
            {DRAGON_TOWER_DIFFICULTIES[prefs.difficulty].cols} safe, top prize{" "}
            {formatMultiplier(dragonTowerMultiplier(prefs.difficulty, DRAGON_TOWER_ROWS))}
          </T>
        </View>
        <Segmented
          accessibilityLabel="Difficulty"
          value={prefs.difficulty}
          options={DIFFICULTIES.map((d) => ({ value: d, label: d.slice(0, 4) }))}
          onChange={(difficulty) => setPrefs({ difficulty })}
        />
      </View>
      <Btn label="Place bet" size="lg" onPress={() => round.start(prefs.bet, { difficulty: prefs.difficulty }) && playSound("bet")} silent />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
