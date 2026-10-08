import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "@/components/layout/TabBar";
import { C } from "@/config/theme";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.page },
        animation: "none",
        // Disabling freezeOnBlur and lazy to avoid jitter when switching tabs.
        freezeOnBlur: false,
        lazy: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="fairness" />
      <Tabs.Screen name="statistics" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
