import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "../common/Typography";

export interface ScreenProps {
  /** Small uppercase kicker above the title, e.g. "01 / Home". */
  kicker?: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  /** Set false when the child is its own virtualised list. */
  scroll?: boolean;
}

/** Tab screen frame: safe-area aware, Swiss header with a heavy rule underneath. */
export function Screen({ kicker, title, right, children, scroll = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const header = (
    <Animated.View entering={FadeIn.duration(250)} className="px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          {kicker ? <T variant="label">{kicker}</T> : null}
          <T variant="title" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </T>
        </View>
        {right}
      </View>
      <View className="mt-3 h-[3px] bg-white" />
    </Animated.View>
  );

  if (!scroll) {
    return (
      <View className="flex-1 bg-black">
        {header}
        <View className="flex-1">{children}</View>
      </View>
    );
  }
  return (
    <View className="flex-1 bg-black">
      {header}
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 gap-6" keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

/** Section heading: label text + hairline rule. */
export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <T variant="label">{title}</T>
        <View className="h-px flex-1 bg-white" />
        {right}
      </View>
      {children}
    </View>
  );
}
