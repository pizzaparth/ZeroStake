import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { StatTile } from "@/components/common/KeyValue";
import { ProfitChart } from "@/components/common/ProfitChart";
import { T } from "@/components/common/Typography";
import { GameIcon } from "@/components/game/GameIcon";
import { Screen, Section } from "@/components/layout/Screen";
import { readProfitSeries, readStats, type StatsRow } from "@/engine/persistence/storage";
import { formatCoins, formatCoinsCompact, formatMultiplier, formatSigned } from "@/engine/wallet/money";
import { GAME_BY_ID } from "@/games/registry";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { percent } from "@/utils/format";

function GameRow({ row, index }: { row: StatsRow; index: number }) {
  const meta = row.game ? GAME_BY_ID[row.game] : null;
  if (!meta || !row.game) return null;
  const net = row.returned - row.wagered;
  return (
    <Animated.View entering={FadeInDown.delay(index * 30)} className="flex-row items-center gap-3 border-b border-white py-3">
      <GameIcon id={row.game} size={18} />
      <View className="flex-1">
        <T variant="body" className="font-bold">
          {meta.name}
        </T>
        <T variant="monoSm" className="text-[10px]">
          {row.bets} bets · {percent(row.bets ? row.wins / row.bets : 0, 1)} won · RTP {percent(row.wagered ? row.returned / row.wagered : 0, 1)}
        </T>
      </View>
      <T variant="mono" className="font-mono-bold">
        {formatSigned(net)}
      </T>
    </Animated.View>
  );
}

export default function StatisticsScreen() {
  const { overall, perGame } = useLiveQuery(readStats);
  const series = useLiveQuery(() => readProfitSeries(200));
  const net = overall.returned - overall.wagered;
  const favourite = perGame[0]?.game ? GAME_BY_ID[perGame[0].game].name : "—";

  return (
    <Screen kicker="All local" title="Statistics">
      <View className="gap-1 bg-white p-4">
        <T variant="label" inverted>
          Net profit / loss
        </T>
        <T variant="monoXl" inverted className="text-4xl" numberOfLines={1} adjustsFontSizeToFit>
          {formatSigned(net)}
        </T>
        <T variant="monoSm" inverted>
          Realised RTP {percent(overall.wagered ? overall.returned / overall.wagered : 0)} over {overall.bets} bets
        </T>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <StatTile label="Total wagered" value={formatCoinsCompact(overall.wagered)} />
        <StatTile label="Total won" value={formatCoinsCompact(overall.returned)} />
        <StatTile label="Total lost" value={formatCoinsCompact(Math.max(0, overall.wagered - overall.returned))} sub="stake not returned" />
        <StatTile label="Total bets" value={String(overall.bets)} />
        <StatTile label="Wins" value={String(overall.wins)} />
        <StatTile label="Losses" value={String(overall.losses)} />
        <StatTile label="Win rate" value={percent(overall.bets ? overall.wins / overall.bets : 0, 1)} />
        <StatTile label="Highest win" value={formatCoins(overall.highestWin)} />
        <StatTile label="Highest multiplier" value={formatMultiplier(overall.highestMultiplier)} />
        <StatTile label="Favourite game" value={favourite} />
        <StatTile label="Games played" value={String(perGame.length)} sub="of 13" />
      </View>

      {series.length > 1 ? <ProfitChart series={series} /> : null}

      <Section title="Per game">
        {perGame.length === 0 ? (
          <T variant="small">Play a few rounds to see per-game numbers.</T>
        ) : (
          perGame.map((r, i) => <GameRow key={r.game} row={r} index={i} />)
        )}
      </Section>
    </Screen>
  );
}
