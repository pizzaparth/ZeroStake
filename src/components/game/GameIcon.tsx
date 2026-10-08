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
  videoPoker: Club,
  diamonds: Gem,
};

export function GameIcon({ id, size = 22, color = "#ffffff" }: { id: GameId; size?: number; color?: string }) {
  const Icon = GAME_ICONS[id];
  return <Icon size={size} color={color} strokeWidth={1.75} />;
}
