import { Text, type TextProps } from "react-native";
import { cn } from "heroui-native/utils";

/**
 * Swiss type scale. Hierarchy comes from size, weight, case and tracking —
 * never from grey text. Numbers use the monospaced face so values don't jitter.
 */
const VARIANTS = {
  display: "text-5xl font-black tracking-tighter",
  title: "text-3xl font-black tracking-tight",
  heading: "text-xl font-bold tracking-tight",
  body: "text-base",
  small: "text-sm leading-5",
  label: "text-[11px] font-bold uppercase tracking-[2px]",
  mono: "font-mono text-base",
  monoSm: "font-mono text-xs",
  monoLg: "font-mono-bold text-3xl tracking-tight",
  monoXl: "font-mono-bold text-5xl tracking-tighter",
} as const;

export type TypographyVariant = keyof typeof VARIANTS;

export interface TProps extends TextProps {
  variant?: TypographyVariant;
  /** Black text, for use on white (inverted) blocks. */
  inverted?: boolean;
  className?: string;
}

export function T({ variant = "body", inverted, className, ...rest }: TProps) {
  return <Text {...rest} className={cn(VARIANTS[variant], inverted ? "text-black" : "text-white", className)} />;
}
