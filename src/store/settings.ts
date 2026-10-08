import { DEFAULT_STARTING_BALANCE } from "@/config/app";

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Off = reduced motion: games resolve with minimal animation. */
  animations: boolean;
  /** Show balances like 12.3K instead of 12,345.67. */
  compactNumbers: boolean;
  /** Amount "Reset balance" refills to (cents). */
  startingBalance: number;
  /** Developer view: show seeds, nonce and cursor details on game screens. */
  showRngDetails: boolean;
  /** Player has read the play-money notice shown on first launch. */
  acknowledged: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  animations: true,
  compactNumbers: false,
  startingBalance: DEFAULT_STARTING_BALANCE,
  showRngDetails: false,
  acknowledged: false,
};

/** Settings are stored as JSON values in the key/value `settings` table. */
export function parseSettings(raw: Record<string, string>): Settings {
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (raw[key] === undefined) continue;
    try {
      const value = JSON.parse(raw[key]) as unknown;
      if (typeof value === typeof DEFAULT_SETTINGS[key]) (out as Record<string, unknown>)[key] = value;
    } catch {
      // Ignore a corrupt value and keep the default.
    }
  }
  return out;
}
