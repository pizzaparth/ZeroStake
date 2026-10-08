import { Input, TextField } from "heroui-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { CURRENCY_NAME } from "@/config/app";
import { centsToCoins, formatCoins, parseCoins, type Cents } from "@/engine/wallet/money";
import { useAppStore } from "@/store/appStore";
import { haptic } from "@/utils/feedback";
import { T } from "../common/Typography";

export interface BetInputProps {
  value: Cents;
  onChange: (value: Cents) => void;
  disabled?: boolean;
  /** Extra caption under the field, e.g. potential profit. */
  caption?: string;
}

function Chip({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptic("select");
        onPress();
      }}
      className={`h-11 min-w-11 items-center justify-center border border-white px-2 active:bg-white ${disabled ? "border-dashed" : ""}`}
    >
      {({ pressed }) => (
        <T variant="label" inverted={pressed} className="text-[10px]">
          {label}
        </T>
      )}
    </Pressable>
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
        <T variant="label">Bet amount</T>
        <T variant="monoSm">{invalid ? "Exceeds balance" : `${formatCoins(value)} ${CURRENCY_NAME}`}</T>
      </View>
      <View className="flex-row items-stretch gap-2">
        <TextField isDisabled={disabled} isInvalid={invalid} className="flex-1">
          <Input
            value={text}
            onChangeText={(t) => {
              setText(t);
              const cents = parseCoins(t);
              if (cents !== null) onChange(cents);
            }}
            onBlur={() => setText(centsToCoins(value).toFixed(2))}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel="Bet amount in coins"
            className={`h-11 border border-white bg-black px-3 font-mono text-base text-white ${invalid ? "border-dashed" : ""}`}
          />
        </TextField>
        <Chip label="½" onPress={() => set(Math.floor(value / 2))} disabled={disabled} />
        <Chip label="2×" onPress={() => set(value * 2)} disabled={disabled} />
        <Chip label="Max" onPress={() => set(balance)} disabled={disabled} />
      </View>
      {caption ? <T variant="monoSm">{caption}</T> : null}
    </View>
  );
}
