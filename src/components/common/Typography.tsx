import { Text, type TextProps } from "react-native";
import { cn } from "heroui-native/utils";

/**
 * One family (Inter Tight) with a deliberate weight/size ladder.
 * Numbers use tabular figures so amounts don't jitter as they change.
 * Colours come from theme tokens, so text adapts inside dark game boards.
 */
const VARIANTS = {
  display: "font-display text-[40px] leading-[44px] tracking-tight",
  title: "font-display text-[28px] leading-[34px] tracking-tight",
  heading: "font-display-semi text-[17px] leading-[22px]",
  body: "font-body text-[15px] leading-[21px]",
  small: "font-body text-[13px] leading-[18px]",
  label: "font-body-bold text-[12px] leading-[16px]",
  num: "font-num text-[15px] leading-[20px]",
  numSm: "font-num text-[12px] leading-[16px]",
  numLg: "font-display text-[26px] leading-[32px] tracking-tight",
  numXl: "font-display text-[56px] leading-[62px] tracking-tight",
} as const;

/** Variants that default to the secondary text colour. */
const SOFT: Partial<Record<keyof typeof VARIANTS, true>> = { small: true, label: true, numSm: true };

export type TypographyVariant = keyof typeof VARIANTS;

export interface TProps extends TextProps {
  variant?: TypographyVariant;
  /** Graphite text for use on bright chip-coloured fills. */
  inverted?: boolean;
  className?: string;
}

export function T({ variant = "body", inverted, className, style, ...rest }: TProps) {
  const tone = inverted ? "text-inv" : SOFT[variant] ? "text-soft" : "text-ink";
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[{ fontVariant: ["tabular-nums"] }, style]}
      className={cn(VARIANTS[variant], tone, className)}
    />
  );
}
