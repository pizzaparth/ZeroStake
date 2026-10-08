import { View } from "react-native";
import Animated, { FadeOut, ZoomIn } from "react-native-reanimated";

import { CHIPS } from "@/config/theme";
import { formatMultiplier, formatSigned, type Cents } from "@/engine/wallet/money";
import { T } from "../common/Typography";

export interface ResultBannerProps {
  /** Total return ÷ total stake. */
  multiplier: number;
  profit: Cents;
  visible: boolean;
}

/**
 * Result chip stamped over a board. Mint for a win, red for a loss, gold for
 * a push — and the words always say which, so colour is never the only cue.
 */
export function ResultBanner({ multiplier, profit, visible }: ResultBannerProps) {
  if (!visible) return null;
  const kind = profit > 0 ? "You won" : profit === 0 ? "Stake back" : "No win";
  const chip = CHIPS[profit > 0 ? "mint" : profit === 0 ? "gold" : "red"];
  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <Animated.View
        entering={ZoomIn.duration(180)}
        exiting={FadeOut.duration(100)}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${kind}. ${formatMultiplier(multiplier)}. ${formatSigned(profit)} coins`}
      >
        <View className="min-w-[180px] items-center rounded-3xl px-8 py-5" style={{ backgroundColor: chip.fill }}>
          <T variant="label" style={{ color: chip.text }}>
            {kind}
          </T>
          <T variant="numXl" className="text-[44px] leading-[50px]" numberOfLines={1} adjustsFontSizeToFit style={{ color: chip.text }}>
            {formatMultiplier(multiplier)}
          </T>
          <T variant="num" className="font-body-bold" style={{ color: chip.text }}>
            {formatSigned(profit)}
          </T>
        </View>
      </Animated.View>
    </View>
  );
}
