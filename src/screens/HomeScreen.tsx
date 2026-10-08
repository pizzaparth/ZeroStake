import { router } from "expo-router";
import { ArrowUpRight, History, Settings2, ShieldCheck } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { BalanceDisplay } from "@/components/common/BalanceDisplay";
import { T } from "@/components/common/Typography";
import { GameIcon } from "@/components/game/GameIcon";
import { Screen, Section } from "@/components/layout/Screen";
import { APP_NAME, APP_TAGLINE } from "@/config/app";
import { formatRtp, GAMES, type GameMeta } from "@/games/registry";
import { useAppStore } from "@/store/appStore";
import { haptic } from "@/utils/feedback";

/** Home layout order from the brief: grouped in rows of four. */
const ORDER = ["mines", "plinko", "dice", "limbo", "crash", "dragonTower", "keno", "wheel", "hilo", "blackjack", "videoPoker", "diamonds", "flip"];

function GameCard({ game, index }: { game: GameMeta; index: number }) {
  const animations = useAppStore((s) => s.settings.animations);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={
        animations
          ? FadeInDown.delay(40 * index)
              .springify()
              .damping(18)
          : undefined
      }
      className="w-[48.5%]"
      style={style}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play ${game.name}`}
        accessibilityHint={game.tagline}
        onPressIn={() => scale.set(withSpring(0.96))}
        onPressOut={() => scale.set(withSpring(1))}
        onPress={() => {
          haptic("tap");
          router.push({ pathname: "/game/[id]", params: { id: game.id } });
        }}
        className="aspect-[4/5] justify-between border border-white bg-black p-3 active:bg-white"
      >
        {({ pressed }) => (
          <>
            <View className="flex-row items-start justify-between">
              <T variant="monoSm" inverted={pressed}>
                {String(index + 1).padStart(2, "0")}
              </T>
              <GameIcon id={game.id} color={pressed ? "#000000" : "#ffffff"} />
            </View>
            <View className="gap-1">
              <T variant="heading" inverted={pressed} className="text-2xl font-black leading-7" numberOfLines={2}>
                {game.name}
              </T>
              <T variant="label" inverted={pressed} className="text-[9px]">
                {game.tagline}
              </T>
              <View className={`mt-1 h-px ${pressed ? "bg-black" : "bg-white"}`} />
              <T variant="monoSm" inverted={pressed} className="text-[10px]">
                RTP {formatRtp(game.info.rtp)}
              </T>
            </View>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

function QuickLink({ label, icon: Icon, href }: { label: string; icon: typeof History; href: "/fairness" | "/history" | "/settings" }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        haptic("tap");
        router.navigate(href);
      }}
      className="flex-1 flex-row items-center justify-between border border-white px-3 py-3 active:bg-white"
    >
      {({ pressed }) => (
        <>
          <View className="flex-row items-center gap-2">
            <Icon size={16} color={pressed ? "#000" : "#fff"} />
            <T variant="label" inverted={pressed}>
              {label}
            </T>
          </View>
          <ArrowUpRight size={14} color={pressed ? "#000" : "#fff"} />
        </>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const games = ORDER.map((id) => GAMES.find((g) => g.id === id)!).filter(Boolean);
  return (
    <Screen
      kicker="Offline · Play money"
      title={APP_NAME}
      right={
        <View className="flex-row items-center gap-2">
          <BalanceDisplay />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.navigate("/settings")}
            className="h-9 w-9 items-center justify-center border border-white active:bg-white"
          >
            {({ pressed }) => <Settings2 size={18} color={pressed ? "#000" : "#fff"} />}
          </Pressable>
        </View>
      }
    >
      <View className="mt-2 gap-3">
        <T variant="small">{APP_TAGLINE}</T>
        <View className="flex-row gap-3">
          <QuickLink label="Fairness" icon={ShieldCheck} href="/fairness" />
          <QuickLink label="History" icon={History} href="/history" />
        </View>
      </View>
      <Section title={`Originals · ${games.length}`}>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {games.map((g, i) => (
            <GameCard key={g.id} game={g} index={i} />
          ))}
        </View>
      </Section>
      <T variant="monoSm" className="text-center">
        Coins are fictional and have no cash value.
      </T>
    </Screen>
  );
}
