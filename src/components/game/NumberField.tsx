import { Input, TextField } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { T } from "../common/Typography";

/**
 * Decimal input that only commits valid numbers (clamped on blur).
 * Used for Limbo target, Crash auto cash-out, etc.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  decimals = 2,
  suffix,
  disabled,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  decimals?: number;
  suffix?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const [text, setText] = useState(value.toFixed(decimals));
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    if (Number(text) !== value) setText(value.toFixed(decimals));
  }

  const commit = (t: string) => {
    const n = Number(t);
    if (!Number.isFinite(n)) return setText(value.toFixed(decimals));
    const clamped = Math.min(max, Math.max(min, Math.floor(n * 10 ** decimals) / 10 ** decimals));
    onChange(clamped);
    setText(clamped.toFixed(decimals));
  };

  return (
    <View className="flex-1 gap-1.5">
      <View className="flex-row justify-between">
        <T variant="label">{label}</T>
        {hint ? <T variant="monoSm">{hint}</T> : null}
      </View>
      <TextField isDisabled={disabled}>
        <View className="relative">
          <Input
            value={text}
            onChangeText={(t) => {
              setText(t);
              const n = Number(t);
              if (Number.isFinite(n) && n >= min && n <= max) onChange(Math.floor(n * 10 ** decimals) / 10 ** decimals);
            }}
            onBlur={() => commit(text)}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel={label}
            className="h-11 border border-white bg-black px-3 pr-8 font-mono text-base text-white"
          />
          {suffix ? (
            <View pointerEvents="none" className="absolute bottom-0 right-3 top-0 justify-center">
              <T variant="mono">{suffix}</T>
            </View>
          ) : null}
        </View>
      </TextField>
    </View>
  );
}
