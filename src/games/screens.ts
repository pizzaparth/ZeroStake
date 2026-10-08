import type { ComponentType } from "react";

import BlackjackScreen from "./blackjack/BlackjackScreen";
import CrashScreen from "./crash/CrashScreen";
import DiceScreen from "./dice/DiceScreen";
import DragonTowerScreen from "./dragonTower/DragonTowerScreen";
import FlipScreen from "./flip/FlipScreen";
import HiloScreen from "./hilo/HiloScreen";
import KenoScreen from "./keno/KenoScreen";
import LimboScreen from "./limbo/LimboScreen";
import MinesScreen from "./mines/MinesScreen";
import PlinkoScreen from "./plinko/PlinkoScreen";
import type { GameId } from "./types";
import WheelScreen from "./wheel/WheelScreen";

/** UI layer for each game; engines live next to them in engine.ts. */
export const GAME_SCREENS: Record<GameId, ComponentType> = {
  dice: DiceScreen,
  limbo: LimboScreen,
  mines: MinesScreen,
  dragonTower: DragonTowerScreen,
  wheel: WheelScreen,
  flip: FlipScreen,
  keno: KenoScreen,
  plinko: PlinkoScreen,
  crash: CrashScreen,
  hilo: HiloScreen,
  blackjack: BlackjackScreen,
};
