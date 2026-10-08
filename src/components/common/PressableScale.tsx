import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { MOTION } from "@/config/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, "children" | "style"> {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** How far the element shrinks while held (default 0.97). */
  scaleTo?: number;
}

/**
 * The one press affordance used across the app: the element shrinks slightly
 * and dims for as long as the finger is down. The Pressable itself is the
 * animated, laid-out element (so widths like w-[48%] apply to the grid item),
 * and the animation runs on the UI thread with no re-render per press.
 */
export function PressableScale({ children, className, style, scaleTo = MOTION.pressScale, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }],
    opacity: 1 - 0.12 * pressed.value,
  }));

  return (
    <AnimatedPressable
      {...rest}
      className={className}
      style={[style, animated]}
      onPressIn={(e) => {
        pressed.set(withTiming(1, MOTION.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withTiming(0, MOTION.release));
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
