import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeOutUp, SlideInUp } from "react-native-reanimated";

import { CURRENCY_NAME } from "@/config/app";
import { CHIPS } from "@/config/theme";
import { formatCoins, formatCoinsCompact, formatSigned } from "@/engine/wallet/money";
import { useAppStore } from "@/store/appStore";
import { ChipCoin } from "./ChipCoin";
import { T } from "./Typography";

/**
 * Balance pill. When it changes, a solid mint (gain) or red (spend/loss)
 * pill drops out directly beneath it with the signed amount. It sits above
 * everything else (zIndex) and states the sign in text, not just colour.
 */
export function BalanceDisplay() {
  const balance = useAppStore((s) => s.balance);
  const compact = useAppStore((s) => s.settings.compactNumbers);
  const animations = useAppStore((s) => s.settings.animations);
  const previous = useRef(balance);
  const [delta, setDelta] = useState<{ id: number; amount: number } | null>(null);

  useEffect(() => {
    const diff = balance - previous.current;
    previous.current = balance;
    if (diff === 0) return;
    setDelta({ id: Date.now(), amount: diff });
    const t = setTimeout(() => setDelta(null), 1600);
    return () => clearTimeout(t);
  }, [balance]);

  const text = compact ? formatCoinsCompact(balance) : formatCoins(balance);
  const chip = delta ? CHIPS[delta.amount > 0 ? "mint" : "red"] : null;

  return (
    <View style={{ zIndex: 50, elevation: 50 }} accessible accessibilityLabel={`Balance ${formatCoins(balance)} ${CURRENCY_NAME}`}>
      <View className="h-10 flex-row items-center gap-2 rounded-full bg-surface pl-1.5 pr-3.5">
        <ChipCoin size={26} />
        <T variant="num" numberOfLines={1} className="text-[15px]">
          {text}
        </T>
      </View>
      {delta && chip ? (
        <Animated.View
          key={delta.id}
          entering={animations ? SlideInUp.duration(160) : undefined}
          exiting={animations ? FadeOutUp.duration(180) : undefined}
          className="absolute right-0 top-12 rounded-full px-3 py-1.5"
          style={{ backgroundColor: chip.fill }}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${delta.amount > 0 ? "Gained" : "Spent"} ${formatCoins(Math.abs(delta.amount))} coins`}
        >
          <T variant="num" numberOfLines={1} className="font-display text-[15px]" style={{ color: chip.text }}>
            {formatSigned(delta.amount)}
          </T>
        </Animated.View>
      ) : null}
    </View>
  );
}
