import { router } from "expo-router";
import { ChevronLeft, Info } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScopedTheme } from "uniwind";

import { C } from "@/config/theme";
import type { GameMeta } from "@/games/registry";
import { useAppStore } from "@/store/appStore";
import { BalanceDisplay } from "../common/BalanceDisplay";
import { PressableScale } from "../common/PressableScale";
import { T } from "../common/Typography";
import { GameInfoSheet } from "./GameInfoSheet";

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      scaleTo={0.92}
      className="h-10 w-10 items-center justify-center rounded-full bg-surface"
    >
      {children}
    </PressableScale>
  );
}

export interface GameShellProps {
  game: GameMeta;
  /** The game board. Rendered in the dark board theme. */
  board: ReactNode;
  /** Bet controls + primary action, on the white panel under the board. */
  controls: ReactNode;
}

/**
 * Shared frame for every game: white header, a dark rounded board inset
 * (where the game's colour lives), and the controls below. The header is
 * stacked above the board so the balance-change pill is never hidden.
 */
export function GameShell({ game, board, controls }: GameShellProps) {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState(false);
  const commitment = useAppStore((s) => s.commitment);
  const showRng = useAppStore((s) => s.settings.showRngDetails);

  return (
    <View className="flex-1 bg-page" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 bg-page px-4 pb-3 pt-1" style={{ zIndex: 20, elevation: 20 }}>
        <RoundButton label="Back" onPress={() => requestAnimationFrame(() => router.canGoBack() ? router.back() : router.replace("/"))}>
          <ChevronLeft size={22} color={C.ink} />
        </RoundButton>
        <T
          variant="heading"
          accessibilityRole="header"
          className="flex-1 text-[20px] leading-[26px]"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {game.name}
        </T>
        <BalanceDisplay />
        <RoundButton label={`How ${game.name} works`} onPress={() => setInfo(true)}>
          <Info size={19} color={C.ink} />
        </RoundButton>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScopedTheme theme="dark">
          <View className="mx-3 flex-1 overflow-hidden rounded-3xl bg-game-board">{board}</View>
        </ScopedTheme>
        {showRng && commitment ? (
          <View className="flex-row justify-between gap-2 px-5 pt-2">
            <T variant="numSm">Nonce {commitment.nonce}</T>
            <T variant="numSm" numberOfLines={1} className="flex-1 text-center">
              Client {commitment.clientSeed.slice(0, 10)}
            </T>
            <T variant="numSm">Hash {commitment.serverSeedHash.slice(0, 8)}</T>
          </View>
        ) : null}
        <ScrollView
          className="max-h-[52%] grow-0"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 12, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {controls}
        </ScrollView>
      </KeyboardAvoidingView>

      <GameInfoSheet game={game} open={info} onOpenChange={setInfo} />
    </View>
  );
}
