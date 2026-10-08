import { router } from "expo-router";
import { ChevronRight, History, ShieldCheck } from "lucide-react-native";
import { View } from "react-native";

import { BalanceDisplay } from "@/components/common/BalanceDisplay";
import { PressableScale } from "@/components/common/PressableScale";
import { T } from "@/components/common/Typography";
import { GAME_CHIP, GameIcon } from "@/components/game/GameIcon";
import { Screen } from "@/components/layout/Screen";
import { APP_NAME } from "@/config/app";
import { C, CHIPS } from "@/config/theme";
import { formatRtp, GAMES, type GameMeta } from "@/games/registry";
import { haptic } from "@/utils/feedback";

/** Lobby order from the brief. */
const ORDER = ["mines", "plinko", "dice", "limbo", "crash", "dragonTower", "keno", "wheel", "hilo", "blackjack", "videoPoker", "diamonds", "flip"];

const open = (game: GameMeta) => {
  haptic("tap");
  requestAnimationFrame(() => {
    router.push({ pathname: "/game/[id]", params: { id: game.id } });
  });
};

/** Game card: coloured icon badge, RTP tag, name and one-line description. */
function GameCard({ game, wide }: { game: GameMeta; wide?: boolean }) {
  const chip = CHIPS[GAME_CHIP[game.id]];
  const badge = (
    <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: chip.fill }}>
      <GameIcon id={game.id} size={22} color={chip.text} />
    </View>
  );
  const name = (
    <View className="gap-0.5">
      <T variant="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {game.name}
      </T>
      <T variant="small" numberOfLines={1}>
        {game.tagline}
      </T>
    </View>
  );
  const rtp = (
    <View className="rounded-full bg-page px-2.5 py-1">
      <T variant="numSm" className="text-[11px]">
        {formatRtp(game.info.rtp)}
      </T>
    </View>
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Play ${game.name}`}
      accessibilityHint={`${game.tagline}. Return to player ${formatRtp(game.info.rtp)}`}
      onPress={() => open(game)}
      className={`rounded-3xl bg-surface p-4 ${wide ? "w-full flex-row items-center gap-3" : "h-[148px] w-[48.5%] justify-between"}`}
    >
      {wide ? (
        <>
          {badge}
          <View className="flex-1">{name}</View>
          {rtp}
        </>
      ) : (
        <>
          <View className="flex-row items-start justify-between">
            {badge}
            {rtp}
          </View>
          {name}
        </>
      )}
    </PressableScale>
  );
}

function Shortcut({ label, detail, icon: Icon, href }: { label: string; detail: string; icon: typeof History; href: "/fairness" | "/history" }) {
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        haptic("tap");
        requestAnimationFrame(() => {
          router.navigate(href);
        });
      }}
      className="flex-1 flex-row items-center gap-3 rounded-3xl border border-line bg-page px-3.5 py-3"
    >
      <Icon size={20} color={C.ink} />
      <View className="flex-1">
        <T variant="label" className="text-[14px] text-ink" numberOfLines={1}>
          {label}
        </T>
        <T variant="small" className="text-[12px]" numberOfLines={1}>
          {detail}
        </T>
      </View>
      <ChevronRight size={16} color={C.soft} />
    </PressableScale>
  );
}

export default function HomeScreen() {
  const games = ORDER.map((id) => GAMES.find((g) => g.id === id)!).filter(Boolean);
  const grid = games.slice(0, -1);
  const last = games.at(-1)!;
  return (
    <Screen title={APP_NAME} subtitle="Play-money casino" right={<BalanceDisplay />}>
      <View className="flex-row gap-3">
        <Shortcut label="Fairness" detail="Seeds and checks" icon={ShieldCheck} href="/fairness" />
        <Shortcut label="History" detail="Every bet" icon={History} href="/history" />
      </View>
      <View className="gap-2.5">
        <View className="flex-row items-end justify-between px-1">
          <T variant="heading">Games</T>
          <T variant="small">13 originals</T>
        </View>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {grid.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
          <GameCard game={last} wide />
        </View>
      </View>
      <T variant="small" className="text-center">
        Coins are fictional and have no cash value.
      </T>
    </Screen>
  );
}
