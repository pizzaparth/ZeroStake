import type { BottomTabBarProps } from "expo-router/js-tabs";
import { BarChart3, History, House, Settings2, ShieldCheck, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppStore } from "@/store/appStore";
import { haptic } from "@/utils/feedback";
import { T } from "../common/Typography";

const ICONS: Record<string, LucideIcon> = {
  index: House,
  history: History,
  fairness: ShieldCheck,
  statistics: BarChart3,
  settings: Settings2,
};

const LABELS: Record<string, string> = {
  index: "Home",
  history: "History",
  fairness: "Fairness",
  statistics: "Stats",
  settings: "Settings",
};

/**
 * Swiss tab bar: heavy top rule, a solid white block slides under the active
 * tab and its icon/label invert to black.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const animations = useAppStore((s) => s.settings.animations);
  const [width, setWidth] = useState(0);
  const tabWidth = width / state.routes.length;
  const x = useSharedValue(0);

  useEffect(() => {
    const target = state.index * tabWidth;
    x.value = animations ? withSpring(target, { damping: 22, stiffness: 260 }) : withTiming(target, { duration: 0 });
  }, [state.index, tabWidth, animations, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: tabWidth }));

  return (
    <View className="border-t-[3px] border-white bg-black" style={{ paddingBottom: insets.bottom }}>
      <View className="relative flex-row" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && <Animated.View className="absolute bottom-0 top-0 bg-white" style={indicator} />}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? House;
          const label = LABELS[route.name] ?? route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              className="h-16 flex-1 items-center justify-center gap-1"
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptic("select");
                  navigation.navigate(route.name, route.params);
                }
              }}
            >
              <Icon size={20} color={focused ? "#000000" : "#ffffff"} strokeWidth={focused ? 2.5 : 1.75} />
              <T variant="label" inverted={focused} className="text-[9px] tracking-[1.5px]">
                {label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
