import { useEffect } from "react";
import { View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";

import { isRedSuit, rankLabel, suitSymbol, type Card } from "@/engine/cards/deck";
import { MOTION } from "@/config/theme";
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
      enter.set(1);
      return;
    }
    enter.set(withDelay(delay, withSpring(1, MOTION.spring)));
  }, [animations, delay, enter]);

  useEffect(() => {
    const target = faceDown || !card ? 0 : 1;
    flip.set(animations ? withDelay(delay + 60, withTiming(target, { duration: 170 })) : target);
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
      <Animated.View className="absolute inset-0 items-center justify-center rounded-xl bg-chip-red" style={back}>
        <View className="h-[78%] w-[74%] rounded-lg border-2 border-dashed border-[#ffffff]/50" />
      </Animated.View>
      <Animated.View
        className={`absolute inset-0 justify-between rounded-xl border-[2px] bg-page p-1.5 shadow-sm shadow-black/10 ${ring}`}
        style={[front, { opacity: dim ? 0.55 : 1 }]}
      >
        {card ? (
          <>
            <T variant="numLg" className={`${s.rank} ${red ? "text-[#d6203a]" : "text-ink"}`}>
              {rankLabel(card.rank)}
            </T>
            <T className={`self-center ${s.suit} ${red ? "text-[#d6203a]" : "text-ink"}`}>{suitSymbol(card.suit)}</T>
            <View />
          </>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
