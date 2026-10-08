import * as Clipboard from "expo-clipboard";
import { useToast } from "heroui-native";
import { Copy } from "lucide-react-native";
import { View } from "react-native";

import { C, CHIPS, type ChipColor } from "@/config/theme";
import { haptic } from "@/utils/feedback";
import { PressableScale } from "./PressableScale";
import { T } from "./Typography";

/** Label over value. Long values (seeds, hashes) wrap; copyable rows show a copy glyph and confirm with a toast. */
export function KeyValue({
  label,
  value,
  copyable,
  mono = true,
  last,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
  last?: boolean;
}) {
  const { toast } = useToast();
  const content = (
    <View className={`flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-line"}`}>
      <View className="flex-1 gap-1">
        <T variant="label">{label}</T>
        <T variant={mono ? "num" : "body"} className={mono ? "text-[13px] leading-[19px]" : ""} selectable>
          {value}
        </T>
      </View>
      {copyable ? <Copy size={16} color={C.soft} /> : null}
    </View>
  );
  if (!copyable) return content;
  return (
    <PressableScale
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      onPress={() => {
        void Clipboard.setStringAsync(value);
        haptic("select");
        toast.show({ label: `${label} copied` });
      }}
    >
      {content}
    </PressableScale>
  );
}

/**
 * Statistic tile. Padding scales with the 16 px corner radius so text never
 * crowds the curve; values shrink to fit on one line instead of overflowing.
 */
export function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: ChipColor }) {
  const chip = tone ? CHIPS[tone] : null;
  return (
    <View
      className={`h-[104px] min-w-[46%] flex-1 justify-between rounded-2xl p-4 ${chip ? "" : "bg-surface"}`}
      style={chip ? { backgroundColor: chip.fill } : undefined}
    >
      <T variant="label" numberOfLines={1} style={chip ? { color: chip.text, opacity: 0.85 } : undefined}>
        {label}
      </T>
      <View>
        <T variant="numLg" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={chip ? { color: chip.text } : undefined}>
          {value}
        </T>
        {sub ? (
          <T
            variant="small"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={chip ? { color: chip.text, opacity: 0.85 } : undefined}
          >
            {sub}
          </T>
        ) : null}
      </View>
    </View>
  );
}
