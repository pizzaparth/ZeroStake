import { Platform, View } from "react-native";

import { StatTile } from "@/components/common/KeyValue";
import { ProfitChart } from "@/components/common/ProfitChart";
import { T } from "@/components/common/Typography";
import { GAME_CHIP, GameIcon } from "@/components/game/GameIcon";
import { Panel, Screen, Section } from "@/components/layout/Screen";
import { CHIPS } from "@/config/theme";
import { readProfitSeries, readStats, type StatsRow } from "@/engine/persistence/storage";
import { formatCoins, formatCoinsCompact, formatMultiplier, formatSigned } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { percent } from "@/utils/format";

function GameRow({ row, last }: { row: StatsRow; last: boolean }) {
  const meta = row.game ? GAME_BY_ID[row.game] : null;
  if (!meta || !row.game) return null;
  const net = row.returned - row.wagered;
  const chip = CHIPS[GAME_CHIP[row.game]];
  return (
    <View className={`flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-line"}`}>
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: chip.fill }}>
        <GameIcon id={row.game} size={18} color={chip.text} />
      </View>
      <View className="flex-1">
        <T variant="body" className="font-body-bold">
          {meta.name}
        </T>
        <T variant="small">
          {row.bets} bets, {percent(row.bets ? row.wins / row.bets : 0, 0)} won, returned {percent(row.wagered ? row.returned / row.wagered : 0, 1)}
        </T>
      </View>
      <T variant="num" className={`font-body-bold ${net >= 0 ? "text-pos" : "text-neg"}`}>
        {formatSigned(net)}
      </T>
    </View>
  );
}

export default function StatisticsScreen() {
  const { overall, perGame } = useLiveQuery(readStats);
  const series = useLiveQuery(() => readProfitSeries(200));
  const net = overall.returned - overall.wagered;
  const favourite = perGame[0]?.game ? GAME_BY_ID[perGame[0].game].name : "None yet";
  const up = net >= 0;

  return (
    <Screen title="Your stats" subtitle="Worked out on this phone from your bet history.">
      <View className="items-center gap-1 py-2">
        <T variant="label">{up ? "You're up" : "You're down"}</T>
        <T variant="numXl" className={up ? "text-pos" : "text-neg"} numberOfLines={1} adjustsFontSizeToFit>
          {formatSigned(net)}
        </T>
        <T variant="small">
          {overall.bets} bets returned {percent(overall.wagered ? overall.returned / overall.wagered : 0)} of what you staked
        </T>
      </View>

      {series.length > 1 && Platform.OS !== "web" ? <ProfitChart series={series} /> : null}

      <View className="flex-row flex-wrap gap-3">
        <StatTile label="Wagered" value={formatCoinsCompact(overall.wagered)} />
        <StatTile label="Won back" value={formatCoinsCompact(overall.returned)} />
        <StatTile label="Lost" value={formatCoinsCompact(Math.max(0, overall.wagered - overall.returned))} />
        <StatTile
          label="Win rate"
          value={percent(overall.bets ? overall.wins / overall.bets : 0, 1)}
          sub={`${overall.wins} wins, ${overall.losses} losses`}
        />
        <StatTile label="Biggest win" value={overall.highestWin > 0 ? formatCoins(overall.highestWin) : "None yet"} />
        <StatTile label="Best multiplier" value={overall.highestMultiplier > 0 ? formatMultiplier(overall.highestMultiplier) : "None yet"} />
        <StatTile label="Favourite game" value={favourite} sub={`${perGame.length} of 13 games played`} />
      </View>

      <Section title="By game">
        {perGame.length === 0 ? (
          <T variant="small">Play a few rounds and each game shows up here.</T>
        ) : (
          <Panel className="py-1">
            {perGame.map((r, i) => (
              <GameRow key={r.game} row={r} last={i === perGame.length - 1} />
            ))}
          </Panel>
        )}
      </Section>
    </Screen>
  );
}
