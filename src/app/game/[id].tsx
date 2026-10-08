import { Redirect, useLocalSearchParams } from "expo-router";

import { GAME_SCREENS } from "@/games/screens";
import type { GameId } from "@/games/types";

export default function GameRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Screen = GAME_SCREENS[id as GameId];
  if (!Screen) return <Redirect href="/" />;
  return <Screen />;
}
