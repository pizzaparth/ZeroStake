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
    <View className="flex-row items-center justify-between gap-3 px-5 pb-3 pt-2">
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
      <View className="flex-1 bg-page" style={{ paddingTop: insets.top }}>
        {header}
        <View className="flex-1">{children}</View>
      </View>
    );
  }
  return (
    <View className="flex-1 bg-page">
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
      >
        {header}
        <View className="px-5 pb-2 pt-2 gap-6">
          {children}
        </View>
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

/** Grouped surface (radius 24, padding 16 — text stays clear of the curve). */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-3xl bg-surface px-4 py-3 ${className}`}>{children}</View>;
}
