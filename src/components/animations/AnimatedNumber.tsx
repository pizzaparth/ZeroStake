import { useEffect } from "react";
import { TextInput, type TextInputProps } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface AnimatedNumberProps extends Omit<TextInputProps, "value" | "editable"> {
  /** Drive from an external shared value (e.g. Crash), or animate to `to`. */
  value?: SharedValue<number>;
  to?: number;
  from?: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  onDone?: () => void;
  className?: string;
}

/**
 * Number rendered on the UI thread (no React re-render per frame): a
 * read-only TextInput whose text is set from a Reanimated shared value.
 */
export function AnimatedNumber({ value, to = 0, from = 0, duration = 600, decimals = 2, suffix = "", onDone, ...rest }: AnimatedNumberProps) {
  const internal = useSharedValue(from);
  const source = value ?? internal;

  useEffect(() => {
    if (value) return;
    internal.value = from;
    internal.value = withTiming(to, { duration, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished && onDone) scheduleOnRN(onDone);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, from, duration]);

  const animatedProps = useAnimatedProps(() => {
    const text = `${source.value.toFixed(decimals)}${suffix}`;
    return { text, defaultValue: text } as unknown as TextInputProps;
  });

  return (
    <AnimatedTextInput
      {...rest}
      editable={false}
      underlineColorAndroid="transparent"
      pointerEvents="none"
      defaultValue={`${(value ? value.value : from).toFixed(decimals)}${suffix}`}
      animatedProps={animatedProps}
    />
  );
}
