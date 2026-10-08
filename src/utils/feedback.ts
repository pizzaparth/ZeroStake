import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

import { useAppStore } from "@/store/appStore";

/** Sound + haptic feedback, both gated by the user's settings. Fully offline (bundled assets). */

const SOURCES = {
  tap: require("@/assets/sounds/tap.wav"),
  bet: require("@/assets/sounds/bet.wav"),
  tick: require("@/assets/sounds/tick.wav"),
  reveal: require("@/assets/sounds/reveal.wav"),
  win: require("@/assets/sounds/win.wav"),
  bigwin: require("@/assets/sounds/bigwin.wav"),
  lose: require("@/assets/sounds/lose.wav"),
  bust: require("@/assets/sounds/bust.wav"),
  cashout: require("@/assets/sounds/cashout.wav"),
  card: require("@/assets/sounds/card.wav"),
} as const;

export type SoundName = keyof typeof SOURCES;

const players = new Map<SoundName, AudioPlayer>();
let audioModeSet = false;

function player(name: SoundName): AudioPlayer {
  let p = players.get(name);
  if (!p) {
    p = createAudioPlayer(SOURCES[name]);
    p.volume = 0.6;
    players.set(name, p);
  }
  return p;
}

export function playSound(name: SoundName) {
  if (!useAppStore.getState().settings.sound) return;
  try {
    if (!audioModeSet) {
      audioModeSet = true;
      // Respect the iOS silent switch: game sounds are not essential audio.
      void setAudioModeAsync({ playsInSilentMode: false });
    }
    const p = player(name);
    void p.seekTo(0).then(() => p.play());
  } catch {
    // Audio is decoration; never let it break a bet.
  }
}

type HapticKind = "tap" | "select" | "success" | "error" | "heavy";

export function haptic(kind: HapticKind) {
  if (!useAppStore.getState().settings.haptics) return;
  const run = {
    tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    select: () => Haptics.selectionAsync(),
    success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  }[kind];
  run().catch(() => undefined);
}

/** Standard result feedback: win / big win / loss. */
export function resultFeedback(multiplier: number, stakeUnits = 1) {
  const ratio = stakeUnits > 0 ? multiplier / stakeUnits : 0;
  if (ratio > 1) {
    playSound(ratio >= 10 ? "bigwin" : "win");
    haptic("success");
  } else if (ratio === 1) {
    playSound("tap");
    haptic("select");
  } else {
    playSound("lose");
    haptic("error");
  }
}
