import { router } from "expo-router";
import { ChevronLeft, Info } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  /** The game board. */
  board: ReactNode;
  /** Bet controls + primary action, on the white panel under the board. */
  controls: ReactNode;
}

export function GameShell({ game, board, controls }: GameShellProps) {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState(false);
  const commitment = useAppStore((s) => s.commitment);
  const showRng = useAppStore((s) => s.settings.showRngDetails);

  return (
    <View className="flex-1 bg-page">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top || 16, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          bounces={true}
          automaticallyAdjustKeyboardInsets={true}
        >
          <View className="flex-row items-center gap-3 px-4 pb-4 pt-1">
            <RoundButton label="Back" onPress={() => requestAnimationFrame(() => router.canGoBack() ? router.back() : router.replace("/"))}>
              <ChevronLeft size={22} color={C.ink} />
            </RoundButton>
            <T
              variant="heading"
              accessibilityRole="header"
              className="flex-1 text-[20px]"
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

          <View className="flex-1 w-full" style={{ minHeight: 400 }}>
            {board}
          </View>

          {showRng && commitment ? (
            <View className="flex-row justify-between gap-2 px-6 pt-3">
              <T variant="numSm">Nonce {commitment.nonce}</T>
              <T variant="numSm" numberOfLines={1} className="flex-1 text-center">
                Client {commitment.clientSeed.slice(0, 10)}
              </T>
              <T variant="numSm">Hash {commitment.serverSeedHash.slice(0, 8)}</T>
            </View>
          ) : null}

          <View className="px-5 pt-5 gap-4 pb-2 justify-end">
            {controls}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <GameInfoSheet game={game} open={info} onOpenChange={setInfo} />
    </View>
  );
}
