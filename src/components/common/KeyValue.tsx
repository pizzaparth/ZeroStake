import * as Clipboard from "expo-clipboard";
import { Pressable, View } from "react-native";

import { haptic } from "@/utils/feedback";
import { T } from "./Typography";

/** Label / value row separated by a hairline. Values are monospaced and optionally copyable. */
export function KeyValue({ label, value, copyable, mono = true }: { label: string; value: string; copyable?: boolean; mono?: boolean }) {
  const content = (
    <View className="gap-1 border-b border-white py-2.5">
      <View className="flex-row items-center justify-between">
        <T variant="label">{label}</T>
        {copyable ? (
          <T variant="label" className="text-[9px]">
            Tap to copy
          </T>
        ) : null}
      </View>
      <T variant={mono ? "monoSm" : "small"} selectable>
        {value}
      </T>
    </View>
  );
  if (!copyable) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      onPress={() => {
        void Clipboard.setStringAsync(value);
        haptic("select");
      }}
    >
      {content}
    </Pressable>
  );
}

/** Big number tile for statistics. */
export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="min-w-[46%] flex-1 gap-1 border border-white p-3">
      <T variant="label" className="text-[10px]">
        {label}
      </T>
      <T variant="mono" className="font-mono-bold text-xl" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      {sub ? <T variant="monoSm">{sub}</T> : null}
    </View>
  );
}
