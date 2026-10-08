import { useEffect } from "react";
import { View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";

import { isRedSuit, rankLabel, suitSymbol, type Card } from "@/engine/cards/deck";
import { useAppStore } from "@/store/appStore";
import { T } from "../common/Typography";

const SIZES = {
  sm: { w: 52, h: 74, rank: "text-lg", suit: "text-2xl" },
  md: { w: 68, h: 96, rank: "text-xl", suit: "text-3xl" },
  lg: { w: 110, h: 156, rank: "text-3xl", suit: "text-6xl" },
} as const;

/**
 * Card that slides in and flips face-up. `faceDown` keeps it hidden (dealer
 * hole card); toggling it flips the card over.
 */
export function PlayingCard({
  card,
  faceDown = false,
  size = "md",
  delay = 0,
  highlight,
  dim,
}: {
  card: Card | null;
  faceDown?: boolean;
  size?: keyof typeof SIZES;
  delay?: number;
  highlight?: "win" | "loss" | "hold" | null;
  dim?: boolean;
}) {
  const animations = useAppStore((s) => s.settings.animations);
  const s = SIZES[size];
  const enter = useSharedValue(animations ? 0 : 1);
  const flip = useSharedValue(faceDown || !card || !animations ? (faceDown || !card ? 0 : 1) : 0);

  useEffect(() => {
    if (!animations) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(delay, withSpring(1, { damping: 16, stiffness: 180 }));
  }, [animations, delay, enter]);

  useEffect(() => {
    const target = faceDown || !card ? 0 : 1;
    flip.value = animations ? withDelay(delay + 120, withTiming(target, { duration: 300 })) : target;
  }, [faceDown, card, animations, delay, flip]);

  const wrapper = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [-40, 0]) }, { rotate: `${interpolate(enter.value, [0, 1], [-8, 0])}deg` }],
  }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateY: `${flip.value * 180}deg` }], backfaceVisibility: "hidden" }));
  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${flip.value * 180 + 180}deg` }],
    backfaceVisibility: "hidden",
  }));

  const ring =
    highlight === "win"
      ? "border-game-win"
      : highlight === "loss"
        ? "border-game-loss"
        : highlight === "hold"
          ? "border-game-gold"
          : "border-transparent";
  const red = card ? isRedSuit(card.suit) : false;

  return (
    <Animated.View
      style={[{ width: s.w, height: s.h }, wrapper]}
      accessible
      accessibilityLabel={card && !faceDown ? `${rankLabel(card.rank)} of ${card.suit}` : "Face-down card"}
    >
      <Animated.View className="absolute inset-0 items-center justify-center rounded-lg border-2 border-[#3a4b5c] bg-[#1b2a3a]" style={back}>
        <View className="h-[70%] w-[70%] rounded-md border border-[#49b8ff]/40" />
      </Animated.View>
      <Animated.View
        className={`absolute inset-0 justify-between rounded-lg border-[3px] bg-white p-1.5 ${ring}`}
        style={[front, { opacity: dim ? 0.55 : 1 }]}
      >
        {card ? (
          <>
            <T variant="mono" className={`font-mono-bold ${s.rank} ${red ? "text-[#e0243c]" : "text-black"}`}>
              {rankLabel(card.rank)}
            </T>
            <T className={`self-center ${s.suit} ${red ? "text-[#e0243c]" : "text-black"}`}>{suitSymbol(card.suit)}</T>
            <View />
          </>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
