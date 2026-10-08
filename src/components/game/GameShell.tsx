import { router } from "expo-router";
import { ChevronLeft, Info } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { GameMeta } from "@/games/registry";
import { useAppStore } from "@/store/appStore";
import { BalanceDisplay } from "../common/BalanceDisplay";
import { T } from "../common/Typography";
import { GameInfoSheet } from "./GameInfoSheet";

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: (pressed: boolean) => ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-10 w-10 items-center justify-center border border-white active:bg-white"
    >
      {({ pressed }) => children(pressed)}
    </Pressable>
  );
}

export interface GameShellProps {
  game: GameMeta;
  /** The coloured game board (games may use colour; chrome may not). */
  board: ReactNode;
  /** Bet controls + primary action, rendered on black under the board. */
  controls: ReactNode;
}

/**
 * Shared frame for every game: header (back, title, balance, info),
 * a flexible board area, and a controls panel. Mobile-first: the board takes
 * the remaining height and the controls scroll if a small phone needs it.
 */
export function GameShell({ game, board, controls }: GameShellProps) {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState(false);
  const commitment = useAppStore((s) => s.commitment);
  const showRng = useAppStore((s) => s.settings.showRngDetails);

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b-[3px] border-white px-4 pb-3 pt-2">
        <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          {(p) => <ChevronLeft size={20} color={p ? "#000" : "#fff"} />}
        </IconButton>
        <T variant="heading" accessibilityRole="header" className="flex-1 text-2xl font-black uppercase" numberOfLines={1} adjustsFontSizeToFit>
          {game.name}
        </T>
        <BalanceDisplay />
        <IconButton label={`${game.name} info`} onPress={() => setInfo(true)}>
          {(p) => <Info size={18} color={p ? "#000" : "#fff"} />}
        </IconButton>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-1 bg-game-board">{board}</View>
        {showRng && commitment ? (
          <View className="flex-row justify-between border-t border-white px-4 py-1.5">
            <T variant="monoSm" className="text-[10px]">
              nonce {commitment.nonce}
            </T>
            <T variant="monoSm" className="text-[10px]" numberOfLines={1}>
              client {commitment.clientSeed.slice(0, 12)}
            </T>
            <T variant="monoSm" className="text-[10px]">
              hash {commitment.serverSeedHash.slice(0, 10)}…
            </T>
          </View>
        ) : null}
        <ScrollView
          className="max-h-[48%] grow-0 border-t-[3px] border-white bg-black"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 14 }}
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
