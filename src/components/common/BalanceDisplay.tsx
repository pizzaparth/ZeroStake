import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInDown, FadeOutUp, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { CURRENCY_NAME } from "@/config/app";
import { formatCoins, formatCoinsCompact, formatSigned } from "@/engine/wallet/money";
import { useAppStore } from "@/store/appStore";
import { T } from "./Typography";

/**
 * Live balance. Changes flash the block (white → black) and float the delta
 * above it, so wins and losses read without colour.
 */
export function BalanceDisplay({ size = "sm" }: { size?: "sm" | "lg" }) {
  const balance = useAppStore((s) => s.balance);
  const compact = useAppStore((s) => s.settings.compactNumbers);
  const animations = useAppStore((s) => s.settings.animations);
  const previous = useRef(balance);
  const [delta, setDelta] = useState<{ id: number; amount: number } | null>(null);
  // A white block wipes across on change: pure black/white motion, no grey fade.
  const wipe = useSharedValue(-1);
  const width = useSharedValue(0);

  useEffect(() => {
    const diff = balance - previous.current;
    previous.current = balance;
    if (diff === 0) return;
    setDelta({ id: Date.now(), amount: diff });
    if (animations) wipe.value = withSequence(withTiming(-1, { duration: 0 }), withTiming(1, { duration: 420 }));
    const t = setTimeout(() => setDelta(null), 1400);
    return () => clearTimeout(t);
  }, [balance, animations, wipe]);

  const wipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: wipe.value * width.value }] }));
  const text = compact ? formatCoinsCompact(balance) : formatCoins(balance);

  return (
    <View accessible accessibilityLabel={`Balance ${formatCoins(balance)} ${CURRENCY_NAME}`} className={size === "lg" ? "" : "items-end"}>
      <View className="relative overflow-hidden border border-white px-3 py-1.5" onLayout={(e) => (width.value = e.nativeEvent.layout.width)}>
        <Animated.View pointerEvents="none" className="absolute inset-0 bg-white" style={wipeStyle} />
        <View className="flex-row items-baseline gap-1.5">
          <T variant={size === "lg" ? "monoLg" : "mono"} className={size === "lg" ? "" : "text-sm"}>
            {text}
          </T>
          <T variant="label" className="text-[9px]">
            {CURRENCY_NAME}
          </T>
        </View>
      </View>
      {delta && (
        <Animated.View key={delta.id} entering={FadeInDown.duration(180)} exiting={FadeOutUp.duration(400)} className="absolute -bottom-5 right-0">
          <T variant="monoSm" className="font-mono-bold">
            {formatSigned(delta.amount)}
          </T>
        </Animated.View>
      )}
    </View>
  );
}
