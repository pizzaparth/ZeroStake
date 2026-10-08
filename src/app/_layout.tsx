import "../global.css";

import { JetBrainsMono_300Light } from "@expo-google-fonts/jetbrains-mono/300Light";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";

import { FirstLaunchNotice } from "@/components/common/FirstLaunchNotice";
import { useAppStore } from "@/store/appStore";

SplashScreen.preventAutoHideAsync();
Uniwind.setTheme("dark");

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "#000000", card: "#000000", border: "#ffffff", text: "#ffffff", primary: "#ffffff" },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ JetBrainsMono_300Light, JetBrainsMono_500Medium, JetBrainsMono_700Bold });
  const ready = useAppStore((s) => s.ready);
  const animations = useAppStore((s) => s.settings.animations);

  useEffect(() => {
    // Offline startup: open SQLite → migrate → load wallet, seeds, settings.
    useAppStore.getState().init();
  }, []);

  useEffect(() => {
    if (fontsLoaded && ready) void SplashScreen.hideAsync();
  }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      <HeroUINativeProvider
        config={{
          animation: animations ? undefined : "disable-all",
          toast: { defaultProps: { placement: "bottom" } },
          devInfo: { stylingPrinciples: false },
        }}
      >
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#000000" }, animation: animations ? "default" : "none" }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="game/[id]" options={{ animation: animations ? "slide_from_right" : "none", gestureEnabled: true }} />
            <Stack.Screen name="bet/[id]" options={{ presentation: "modal", animation: animations ? "slide_from_bottom" : "none" }} />
          </Stack>
          <FirstLaunchNotice />
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
