import type { ReactNode } from "react";
import { Button } from "heroui-native";
import { cn } from "heroui-native/utils";

import { haptic, playSound } from "@/utils/feedback";

export type BtnVariant = "solid" | "outline" | "ghost";

export interface BtnProps {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  accessibilityHint?: string;
  /** Skip the default tap sound (callers that play their own). */
  silent?: boolean;
}

/**
 * HeroUI Button themed for the black/white system:
 *   solid   → white block, black label (primary action)
 *   outline → 1px white rule, white label
 *   ghost   → bare white label
 * Disabled can't use grey or opacity, so it becomes a dashed outline instead.
 */
export function Btn({ label, onPress, variant = "solid", size = "md", disabled, icon, className, accessibilityHint, silent }: BtnProps) {
  const heroVariant = disabled ? "outline" : variant === "solid" ? "primary" : variant === "outline" ? "outline" : "ghost";
  return (
    <Button
      variant={heroVariant}
      size={size}
      isDisabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      onPress={() => {
        if (!silent) playSound("tap");
        haptic("tap");
        onPress?.();
      }}
      className={cn(variant === "outline" && "border-white", disabled && "border-dashed border-white bg-black", className)}
    >
      {icon}
      <Button.Label
        className={cn(
          "font-bold uppercase tracking-[2px]",
          size === "sm" ? "text-xs" : "text-sm",
          heroVariant === "primary" ? "text-black" : "text-white",
        )}
      >
        {label}
      </Button.Label>
    </Button>
  );
}
