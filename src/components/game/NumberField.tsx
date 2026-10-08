import { useState } from "react";
import { TextInput, View } from "react-native";

import { C } from "@/config/theme";

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
    <View className="flex-1 gap-2">
      <View className="flex-row justify-between">
        <T variant="label">{label}</T>
        {hint ? <T variant="small">{hint}</T> : null}
      </View>
      <View className="h-12 flex-row items-center rounded-[14px] bg-surface px-3.5" style={{ opacity: disabled ? 0.4 : 1 }}>
        <TextInput
          value={text}
          editable={!disabled}
          onChangeText={(t) => {
            setText(t);
            const n = Number(t);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(Math.floor(n * 10 ** decimals) / 10 ** decimals);
          }}
          onBlur={() => commit(text)}
          keyboardType="decimal-pad"
          selectTextOnFocus
          selectionColor={C.ink}
          accessibilityLabel={label}
          className="h-full flex-1 font-num text-[17px] text-ink"
          style={{ padding: 0, fontVariant: ["tabular-nums"] }}
        />
        {suffix ? (
          <T variant="num" className="text-soft">
            {suffix}
          </T>
        ) : null}
      </View>
    </View>
  );
}

/** Read-only value box that matches NumberField. */
export function ValueBox({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-2">
      <T variant="label">{label}</T>
      <View className="h-12 justify-center rounded-[14px] bg-surface px-3.5">
        <T variant="num" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className="text-[17px]">
          {value}
        </T>
      </View>
    </View>
  );
}
