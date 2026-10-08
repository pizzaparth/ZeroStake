import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "@/components/layout/TabBar";
import { useAppStore } from "@/store/appStore";

export default function TabsLayout() {
  const animations = useAppStore((s) => s.settings.animations);
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "#000000" }, animation: animations ? "shift" : "none" }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="fairness" />
      <Tabs.Screen name="statistics" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
