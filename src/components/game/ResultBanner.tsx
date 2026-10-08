import { View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";

import { formatMultiplier, formatSigned, type Cents } from "@/engine/wallet/money";
import { T } from "../common/Typography";

export interface ResultBannerProps {
  /** Total return ÷ total stake. */
  multiplier: number;
  profit: Cents;
  visible: boolean;
}

/**
 * Result stamp over a game board. Colour is a bonus on the board; the words
 * WIN / PUSH / LOSS and the signed profit carry the meaning on their own.
 */
export function ResultBanner({ multiplier, profit, visible }: ResultBannerProps) {
  if (!visible) return null;
  const kind = profit > 0 ? "WIN" : profit === 0 ? "PUSH" : "LOSS";
  const tone = kind === "WIN" ? "border-game-win" : kind === "LOSS" ? "border-game-loss" : "border-white";
  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <Animated.View
        entering={ZoomIn.springify().damping(14)}
        exiting={ZoomOut.duration(150)}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${kind}. ${formatMultiplier(multiplier)}. ${formatSigned(profit)} coins`}
        className={`items-center border-4 bg-black px-6 py-3 ${tone}`}
      >
        <T variant="label" className="text-xs tracking-[4px]">
          {kind}
        </T>
        <T variant="monoXl" className="text-4xl">
          {formatMultiplier(multiplier)}
        </T>
        <T variant="mono" className="font-mono-bold">
          {formatSigned(profit)}
        </T>
      </Animated.View>
    </View>
  );
}
