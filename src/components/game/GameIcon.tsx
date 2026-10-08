import {
  ArrowUpDown,
  ArrowUpRight,
  Bomb,
  Castle,
  Club,
  Coins,
  Dice5,
  Disc3,
  Gem,
  Grid3x3,
  Rocket,
  Spade,
  Triangle,
  type LucideIcon,
} from "lucide-react-native";

import type { GameId } from "@/games/types";

export const GAME_ICONS: Record<GameId, LucideIcon> = {
  dice: Dice5,
  limbo: ArrowUpRight,
  mines: Bomb,
  dragonTower: Castle,
  wheel: Disc3,
  flip: Coins,
  keno: Grid3x3,
  plinko: Triangle,
  hilo: ArrowUpDown,
  crash: Rocket,
  blackjack: Spade,
};

export function GameIcon({ id, size = 22, color = "#fff6e8" }: { id: GameId; size?: number; color?: string }) {
  const Icon = GAME_ICONS[id];
  return <Icon size={size} color={color} strokeWidth={1.75} />;
}

/** Each game's chip colour on the lobby and in its header. */
export const GAME_CHIP: Record<GameId, import("@/config/theme").ChipColor> = {
  mines: "red",
  plinko: "blue",
  dice: "gold",
  limbo: "mint",
  crash: "blue",
  dragonTower: "red",
  keno: "mint",
  wheel: "gold",
  hilo: "red",
  blackjack: "blue",
  flip: "red",
};
