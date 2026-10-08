import type { ReactNode } from "react";
import { View } from "react-native";
import { cn } from "heroui-native/utils";

import { CHIPS, type ChipColor } from "@/config/theme";
import { haptic, playSound } from "@/utils/feedback";
import { PressableScale } from "./PressableScale";
import { T } from "./Typography";

export type BtnVariant = "solid" | "outline" | "ghost";

export interface BtnProps {
  label: string;
  onPress?: () => void;
  /** solid = primary (graphite, or the `tone` chip colour), outline = soft surface, ghost = text only. */
  variant?: BtnVariant;
  tone?: ChipColor;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  accessibilityHint?: string;
  /** Skip the default tap sound (callers that play their own). */
  silent?: boolean;
}

const SIZE = {
  sm: { h: "h-10", px: "px-4", text: "text-[14px]", radius: "rounded-xl" },
  md: { h: "h-12", px: "px-5", text: "text-[15px]", radius: "rounded-[14px]" },
  lg: { h: "h-14", px: "px-6", text: "text-[16px]", radius: "rounded-2xl" },
} as const;

/** Flat button with a scale-and-dim press state. Disabled = 40% opacity, no press. */
export function Btn({ label, onPress, variant = "solid", tone, size = "md", disabled, icon, className, accessibilityHint, silent }: BtnProps) {
  const s = SIZE[size];
  const chip = tone && variant === "solid" ? CHIPS[tone] : null;
  const surface = variant === "solid" ? (chip ? "" : "bg-primary") : variant === "outline" ? "bg-surface-2" : "bg-transparent";
  const textClass = variant === "solid" ? (chip ? "" : "text-on-primary") : "text-ink";

  return (
    <View className={cn("w-full", className)} style={{ opacity: disabled ? 0.4 : 1 }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => {
          if (!silent) playSound("tap");
          haptic("tap");
          onPress?.();
        }}
        className={cn("flex-row items-center justify-center gap-2", s.h, s.px, s.radius, surface)}
        style={chip ? { backgroundColor: chip.fill } : undefined}
      >
        {icon}
        <T
          variant="label"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          className={cn("font-body-bold", s.text, textClass)}
          style={chip ? { color: chip.text } : undefined}
        >
          {label}
        </T>
      </PressableScale>
    </View>
  );
}
