import { View } from "react-native";

import { T } from "../common/Typography";

/** Live value in a game's control panel (current multiplier, odds…). Values shrink to fit rather than overflow. */
export function Readout({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className={`min-h-[60px] flex-1 justify-center rounded-3xl px-3.5 py-2 ${highlight ? "bg-chip-gold" : "bg-surface"}`}>
      <T variant="label" inverted={highlight} numberOfLines={1}>
        {label}
      </T>
      <T
        variant="num"
        inverted={highlight}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        className="font-display text-[18px] leading-[24px]"
      >
        {value}
      </T>
    </View>
  );
}
