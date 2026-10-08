import type { BottomTabBarProps } from "expo-router/js-tabs";
import { BarChart3, History, House, Settings2, ShieldCheck, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "@/config/theme";
import { haptic } from "@/utils/feedback";
import { T } from "../common/Typography";

const ICONS: Record<string, LucideIcon> = { index: House, history: History, fairness: ShieldCheck, statistics: BarChart3, settings: Settings2 };
const LABELS: Record<string, string> = { index: "Lobby", history: "History", fairness: "Fairness", statistics: "Stats", settings: "Settings" };

/**
 * Standard bottom bar: white, hairline on top, active tab shown by a filled
 * icon pill and bold label. Switching is instant — no transition to wait on.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row border-t border-line bg-page px-2 pt-1.5" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
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
            hitSlop={4}
            className="flex-1 items-center gap-1 py-1"
            onPressIn={() => {
              // Navigate on touch-down: the switch lands before the finger lifts.
              if (focused) return;
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented) {
                haptic("select");
                navigation.navigate(route.name, route.params);
              }
            }}
          >
            <View className={`h-8 w-14 items-center justify-center rounded-full ${focused ? "bg-ink" : ""}`}>
              <Icon size={19} color={focused ? C.page : C.soft} strokeWidth={focused ? 2.4 : 2} />
            </View>
            <T variant="label" className={`text-[11px] ${focused ? "text-ink" : "text-soft"}`}>
              {label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
