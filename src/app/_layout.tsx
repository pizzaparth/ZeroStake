import "../global.css";

import { InterTight_500Medium } from "@expo-google-fonts/inter-tight/500Medium";
import { InterTight_600SemiBold } from "@expo-google-fonts/inter-tight/600SemiBold";
import { InterTight_700Bold } from "@expo-google-fonts/inter-tight/700Bold";
import { InterTight_800ExtraBold } from "@expo-google-fonts/inter-tight/800ExtraBold";
import { useFonts } from "expo-font";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";

import { FirstLaunchNotice } from "@/components/common/FirstLaunchNotice";
import { C } from "@/config/theme";
import { prepareDb } from "@/engine/persistence/db";
import { useAppStore } from "@/store/appStore";

SplashScreen.preventAutoHideAsync();
Uniwind.setTheme("light");

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.page, card: C.page, border: C.line, text: C.ink, primary: C.ink },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
  });
  const ready = useAppStore((s) => s.ready);
  const animations = useAppStore((s) => s.settings.animations);
  const acknowledged = useAppStore((s) => s.settings.acknowledged);

  useEffect(() => {
    // Offline startup: open SQLite → migrate → load wallet, seeds, settings.
    void prepareDb().then(() => useAppStore.getState().init());
  }, []);

  useEffect(() => {
    if (fontsLoaded && ready) void SplashScreen.hideAsync();
  }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.page }}>
      <HeroUINativeProvider
        config={{
          animation: animations ? undefined : "disable-all",
          toast: { defaultProps: { placement: "top" } },
          devInfo: { stylingPrinciples: false },
        }}
      >
        <ThemeProvider value={navTheme}>
          <StatusBar style="dark" />
          {!acknowledged ? (
            <FirstLaunchNotice />
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: C.page },
                animation: animations ? "default" : "none",
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="game/[id]" options={{ animation: animations ? "slide_from_right" : "none", gestureEnabled: true }} />
              <Stack.Screen name="bet/[id]" options={{ presentation: "modal", animation: animations ? "slide_from_bottom" : "none" }} />
            </Stack>
          )}
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
