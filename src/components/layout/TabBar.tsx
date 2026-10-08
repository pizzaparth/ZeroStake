import type { BottomTabBarProps } from "expo-router/js-tabs";
import { BarChart3, History, House, Settings2, ShieldCheck, type LucideIcon } from "lucide-react-native";
import { Pressable, View, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useState } from "react";

import { C } from "@/config/theme";
import { haptic } from "@/utils/feedback";

const ICONS: Record<string, LucideIcon> = { index: House, history: History, fairness: ShieldCheck, statistics: BarChart3, settings: Settings2 };

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [tabWidth, setTabWidth] = useState(0);

  const animatedStyle = useAnimatedStyle(() => {
    const offset = (tabWidth - 48) / 2;
    return {
      transform: [
        { translateX: withTiming(state.index * tabWidth + offset, { duration: 150 }) }
      ]
    };
  }, [state.index, tabWidth]);

  return (
    <View 
      style={{ 
        paddingBottom: Math.max(insets.bottom, 16), 
        paddingTop: 16,
        paddingHorizontal: 24, 
        backgroundColor: 'transparent',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0
      }}
      pointerEvents="box-none"
    >
      <View 
        className="flex-row bg-page rounded-full items-center" 
        style={{ 
          height: 64, 
          shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 10 
        }}
        onLayout={(e: LayoutChangeEvent) => setTabWidth(e.nativeEvent.layout.width / state.routes.length)}
      >
        {tabWidth > 0 && (
          <Animated.View 
            className="absolute h-12 w-12 rounded-full" 
            style={[{ top: 8, left: 0, backgroundColor: "#8a2be2", shadowColor: "#8a2be2", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }, animatedStyle]} 
          />
        )}
        
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? House;
          
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={route.name}
              hitSlop={4}
              className="flex-1 items-center justify-center h-full z-10"
              onPress={() => {
                if (focused) return;
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) {
                  haptic("select");
                  requestAnimationFrame(() => {
                    navigation.navigate(route.name, route.params);
                  });
                }
              }}
            >
              <Icon size={24} color={focused ? C.page : C.soft} strokeWidth={focused ? 2.5 : 2} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
