import { useState } from "react";
import { TextInput, View } from "react-native";

import { C } from "@/config/theme";
import { centsToCoins, formatCoins, parseCoins, type Cents } from "@/engine/wallet/money";
import { useAppStore } from "@/store/appStore";
import { haptic } from "@/utils/feedback";
import { ChipCoin } from "../common/ChipCoin";
import { PressableScale } from "../common/PressableScale";
import { T } from "../common/Typography";

export interface BetInputProps {
  value: Cents;
  onChange: (value: Cents) => void;
  disabled?: boolean;
  /** Extra line under the field, e.g. potential profit. */
  caption?: string;
}

function Shortcut({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      scaleTo={0.92}
      onPress={() => {
        haptic("select");
        onPress();
      }}
      className="h-12 min-w-12 items-center justify-center rounded-[14px] bg-surface px-3.5"
    >
      <T variant="label" className="text-[14px] text-ink">
        {label}
      </T>
    </PressableScale>
  );
}

/** Stake input in coins (stored as cents) with ½ / 2× / max shortcuts. */
export function BetInput({ value, onChange, disabled, caption }: BetInputProps) {
  const balance = useAppStore((s) => s.balance);
  const [text, setText] = useState(centsToCoins(value).toFixed(2));
  const [synced, setSynced] = useState(value);
  const invalid = value > balance;

  // Keep the text in sync when the value changes from outside (shortcut chips).
  if (synced !== value) {
    setSynced(value);
    if (parseCoins(text) !== value) setText(centsToCoins(value).toFixed(2));
  }

  const set = (cents: Cents) => onChange(Math.max(0, Math.min(cents, balance)));

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <T variant="label">Bet</T>
        <T variant="small" className={invalid ? "text-neg" : ""}>
          {invalid ? `More than your ${formatCoins(balance)} balance` : (caption ?? "")}
        </T>
      </View>
      <View className="flex-row items-stretch gap-2">
        <View
          className={`h-12 flex-1 flex-row items-center gap-2.5 rounded-[14px] border bg-surface pl-3.5 pr-3 ${invalid ? "border-neg" : "border-surface"}`}
          style={{ opacity: disabled ? 0.4 : 1 }}
        >
          <ChipCoin size={20} />
          <TextInput
            value={text}
            editable={!disabled}
            onChangeText={(t) => {
              setText(t);
              const cents = parseCoins(t);
              if (cents !== null) onChange(cents);
            }}
            onBlur={() => setText(centsToCoins(value).toFixed(2))}
            keyboardType="decimal-pad"
            selectTextOnFocus
            selectionColor={C.ink}
            accessibilityLabel="Bet amount in coins"
            className="h-full flex-1 font-num text-[17px] text-ink"
            style={{ padding: 0, fontVariant: ["tabular-nums"] }}
          />
        </View>
        <Shortcut label="½" onPress={() => set(Math.floor(value / 2))} disabled={disabled} />
        <Shortcut label="2×" onPress={() => set(value * 2)} disabled={disabled} />
        <Shortcut label="Max" onPress={() => set(balance)} disabled={disabled} />
      </View>
    </View>
  );
}
