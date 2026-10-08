import { Bomb, Gem } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Btn } from "@/components/common/Btn";
import { Segmented } from "@/components/common/Segmented";
import { T } from "@/components/common/Typography";
import { BetInput } from "@/components/game/BetInput";
import { GameShell } from "@/components/game/GameShell";
import { ResultBanner } from "@/components/game/ResultBanner";
import { RevealTile, type TileFace } from "@/components/game/RevealTile";
import { coinsToCents, formatCoins, formatMultiplier, payoutFor } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useGamePrefs, useRound } from "@/hooks/useBetting";
import { playSound } from "@/utils/feedback";
import { MINES_GRID, minesMultiplier, minesProbability, type MinesOutcome, type MinesState } from "./engine";

const game = GAME_BY_ID.mines;
const MINE_OPTIONS = [1, 3, 5, 10, 24];

export default function MinesScreen() {
  const [prefs, setPrefs] = useGamePrefs("mines", { bet: coinsToCents(10), mineCount: 3 });
  const round = useRound<MinesState>("mines");
  // Which settled bet's banner is showing (set after the reveal animation).
  const [shownId, setShownId] = useState<number | null>(null);

  const state = round.state;
  const finished = round.bet?.status === "settled" ? (round.bet.outcome as unknown as MinesOutcome) : null;
  const shown = !!finished && shownId === round.bet?.id;
  const mineCount = state?.mineCount ?? finished?.mineCount ?? prefs.mineCount;
  const revealed = state?.revealed ?? finished?.revealed ?? [];
  const k = revealed.length;
  const current = minesMultiplier(mineCount, k);
  const next = k < MINES_GRID - mineCount ? minesMultiplier(mineCount, k + 1) : null;

  // Reveal the payout once the board has flipped.
  useEffect(() => {
    if (!finished || !round.bet) return;
    const id = round.bet.id;
    const t = setTimeout(() => {
      setShownId(id);
      round.reveal();
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const faceFor = (i: number): TileFace => {
    if (revealed.includes(i)) return "good";
    if (finished) {
      if (finished.hitMine === i) return "bad";
      return finished.mines.includes(i) ? "ghostBad" : "ghostGood";
    }
    return "hidden";
  };

  const start = () => {
    if (round.start(prefs.bet, { mineCount: prefs.mineCount })) playSound("bet");
  };
  const pick = (tile: number) => {
    const row = round.act({ type: "reveal", tile });
    if (!row) return;
    const outcome = row.outcome as unknown as MinesOutcome | null;
    playSound(outcome?.hitMine === tile ? "bust" : "reveal");
  };
  const cashout = () => {
    if (round.act({ type: "cashout" })) playSound("cashout");
  };

  const board = (
    <View className="flex-1 items-center justify-center p-4">
      <View className="aspect-square w-full max-w-[420px] flex-row flex-wrap content-between justify-between">
        {Array.from({ length: MINES_GRID }, (_, i) => (
          <View key={i} className="w-[18.6%]">
            <RevealTile
              face={faceFor(i)}
              disabled={!round.active}
              onPress={() => pick(i)}
              label={`Tile ${i + 1}`}
              good={<Gem size={26} color="#2bff88" />}
              bad={<Bomb size={26} color="#ff3d5a" />}
            />
          </View>
        ))}
      </View>
      {finished && round.bet ? (
        <ResultBanner visible={shown} multiplier={round.bet.payout / round.bet.totalBet} profit={round.bet.payout - round.bet.totalBet} />
      ) : null}
    </View>
  );

  const controls = round.active ? (
    <>
      <View className="flex-row gap-2">
        <View className="flex-1 border border-white p-2">
          <T variant="label" className="text-[9px]">
            Current
          </T>
          <T variant="mono" className="font-mono-bold">
            {formatMultiplier(current)}
          </T>
        </View>
        <View className="flex-1 border border-white p-2">
          <T variant="label" className="text-[9px]">
            Next tile
          </T>
          <T variant="mono" className="font-mono-bold">
            {next ? formatMultiplier(next) : "—"}
          </T>
        </View>
        <View className="flex-1 border border-white p-2">
          <T variant="label" className="text-[9px]">
            Safe chance
          </T>
          <T variant="mono" className="font-mono-bold">
            {next ? `${((minesProbability(mineCount, k + 1) / minesProbability(mineCount, k)) * 100).toFixed(1)}%` : "—"}
          </T>
        </View>
      </View>
      <Btn
        label={k === 0 ? "Pick a tile" : `Cash out ${formatCoins(payoutFor(round.bet!.baseBet, current))}`}
        size="lg"
        onPress={cashout}
        disabled={k === 0}
        silent
      />
    </>
  ) : (
    <>
      <BetInput value={prefs.bet} onChange={(b) => setPrefs({ bet: b })} />
      <View className="gap-2">
        <View className="flex-row justify-between">
          <T variant="label">Mines</T>
          <T variant="monoSm">
            {prefs.mineCount} mines · first tile {formatMultiplier(minesMultiplier(prefs.mineCount, 1))}
          </T>
        </View>
        <Segmented
          accessibilityLabel="Mine count"
          value={MINE_OPTIONS.includes(prefs.mineCount) ? prefs.mineCount : 3}
          options={MINE_OPTIONS.map((m) => ({ value: m, label: String(m) }))}
          onChange={(mineCount) => setPrefs({ mineCount })}
        />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Btn label="−1" size="sm" variant="outline" onPress={() => setPrefs({ mineCount: Math.max(1, prefs.mineCount - 1) })} />
          </View>
          <View className="flex-1">
            <Btn label="+1" size="sm" variant="outline" onPress={() => setPrefs({ mineCount: Math.min(24, prefs.mineCount + 1) })} />
          </View>
        </View>
      </View>
      <Btn label="Bet" size="lg" onPress={start} silent />
    </>
  );

  return <GameShell game={game} board={board} controls={controls} />;
}
