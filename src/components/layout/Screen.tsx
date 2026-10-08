import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "../common/Typography";

export interface ScreenProps {
  /** Optional one-line context under the title. */
  subtitle?: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  /** Set false when the child is its own virtualised list. */
  scroll?: boolean;
}

/** Tab screen frame: white page, large title, optional right slot. Header sits above content (zIndex) so floating pills aren't clipped. */
export function Screen({ subtitle, title, right, children, scroll = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const header = (
    <View className="flex-row items-center justify-between gap-3 bg-page px-5 pb-3" style={{ paddingTop: insets.top + 8, zIndex: 20, elevation: 20 }}>
      <View className="flex-1">
        <T variant="title" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (!scroll) {
    return (
      <View className="flex-1 bg-page">
        {header}
        <View className="flex-1">{children}</View>
      </View>
    );
  }
  return (
    <View className="flex-1 bg-page">
      {header}
      <ScrollView className="flex-1" contentContainerClassName="px-5 pt-2 pb-10 gap-6" keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

/** Section: heading plus content. */
export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View className="gap-2.5">
      <View className="flex-row items-end justify-between px-1">
        <T variant="heading">{title}</T>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Grouped surface (radius 20, padding 16 — text stays clear of the curve). */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-[20px] bg-surface px-4 py-3 ${className}`}>{children}</View>;
}
