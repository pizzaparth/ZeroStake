import type { ReactNode } from "react";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { useAppStore } from "@/store/appStore";

export type TileFace = "hidden" | "good" | "bad" | "ghostGood" | "ghostBad";

/**
 * Board tile that flips (rotateY) from its hidden face to a revealed face.
 * "ghost" faces are revealed after the round for tiles the player didn't pick.
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

  useEffect(() => {
    const target = face === "hidden" ? 0 : 1;
    if (!animations) {
      flip.value = target;
      return;
    }
    flip.value = withTiming(target, { duration: face.startsWith("ghost") ? 220 : 320 });
    if (face === "good" || face === "bad") pop.value = withSequence(withTiming(1.12, { duration: 140 }), withSpring(1));
  }, [face, animations, flip, pop]);

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }, { scale: pop.value }],
    backfaceVisibility: "hidden",
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }, { scale: pop.value }],
    backfaceVisibility: "hidden",
  }));

  const revealedGood = face === "good" || face === "ghostGood";
  const ghost = face.startsWith("ghost");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={face === "hidden" ? label : `${label}: ${revealedGood ? "safe" : "hazard"}`}
      disabled={disabled || face !== "hidden"}
      onPress={onPress}
      className={aspectClass}
    >
      {({ pressed }) => (
        <View className="flex-1">
          <Animated.View
            className={`absolute inset-0 rounded-xl border-b-4 border-black/30 ${pressed && !disabled ? "bg-game-tile-raised" : "bg-game-tile"}`}
            style={front}
          />
          <Animated.View
            className={`absolute inset-0 items-center justify-center rounded-xl ${
              revealedGood ? (ghost ? "bg-game-tile" : "bg-[#0f2a1d]") : ghost ? "bg-game-tile" : "bg-[#3a0f18]"
            }`}
            style={[back, { opacity: ghost ? 0.55 : 1 }]}
          >
            {revealedGood ? good : bad}
          </Animated.View>
        </View>
      )}
    </Pressable>
  );
}
