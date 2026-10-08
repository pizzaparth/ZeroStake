import type { ReactNode } from "react";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { B, MOTION } from "@/config/theme";
import { useAppStore } from "@/store/appStore";

export type TileFace = "hidden" | "good" | "bad" | "ghostGood" | "ghostBad";

/**
 * Board tile that flips (rotateY) from its hidden face to a revealed face.
 * "ghost" faces are revealed after the round for tiles the player didn't pick.
 * Hidden tiles sit on a darker edge and sink when pressed, like the lobby chips.
 */
export function RevealTile({
  face,
  onPress,
  disabled,
  good,
  bad,
  label,
  aspectClass = "aspect-square",
}: {
  face: TileFace;
  onPress?: () => void;
  disabled?: boolean;
  good: ReactNode;
  bad: ReactNode;
  label: string;
  aspectClass?: string;
}) {
  const animations = useAppStore((s) => s.settings.animations);
  const flip = useSharedValue(face === "hidden" ? 0 : 1);
  const pop = useSharedValue(1);
  const sink = useSharedValue(0);

  useEffect(() => {
    const target = face === "hidden" ? 0 : 1;
    if (!animations) {
      flip.set(target);
      return;
    }
    flip.set(withTiming(target, { duration: face.startsWith("ghost") ? 120 : 170 }));
    if (face === "good" || face === "bad") pop.set(withSequence(withTiming(1.1, { duration: 80 }), withSpring(1, MOTION.spring)));
  }, [face, animations, flip, pop]);

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }, { translateY: sink.value * 3 }],
    backfaceVisibility: "hidden",
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }, { scale: pop.value }],
    backfaceVisibility: "hidden",
  }));

  const revealedGood = face === "good" || face === "ghostGood";
  const ghost = face.startsWith("ghost");
  const backColor = ghost ? B.tile : revealedGood ? B.winTint : B.lossTint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={face === "hidden" ? label : `${label}: ${revealedGood ? "safe" : "hazard"}`}
      disabled={disabled || face !== "hidden"}
      onPress={onPress}
      onPressIn={() => sink.set(withTiming(1, MOTION.press))}
      onPressOut={() => sink.set(withTiming(0, MOTION.press))}
      className={aspectClass}
    >
      <View className="flex-1">
        {face === "hidden" ? <View className="absolute bottom-0 left-0 right-0 top-[3px] rounded-xl bg-game-board" /> : null}
        <Animated.View className="absolute bottom-[3px] left-0 right-0 top-0 rounded-xl bg-game-tile-raised" style={front} />
        <Animated.View
          className="absolute inset-0 items-center justify-center rounded-xl"
          style={[back, { backgroundColor: backColor, opacity: ghost ? 0.6 : 1 }]}
        >
          {revealedGood ? good : bad}
        </Animated.View>
      </View>
    </Pressable>
  );
}
