import { GAME_RTP } from "@/config/rtp";
import { cardLabel } from "@/engine/cards/deck";
import { formatMultiplier } from "@/engine/wallet/money";
import { blackjackGame, type BlackjackOutcome } from "./blackjack/engine";
import { crashGame, type CrashOutcome } from "./crash/engine";
import { diamondsGame, diamondsRtp, type DiamondsOutcome } from "./diamonds/engine";
import { diceGame, type DiceOutcome } from "./dice/engine";
import { dragonTowerGame, type DragonTowerOutcome } from "./dragonTower/engine";
import { flipGame, type FlipOutcome } from "./flip/engine";
import { hiloGame, type HiloOutcome } from "./hilo/engine";
import { kenoGame, type KenoOutcome } from "./keno/engine";
import { limboGame, type LimboOutcome } from "./limbo/engine";
import { minesGame, type MinesOutcome } from "./mines/engine";
import { plinkoGame, type PlinkoOutcome } from "./plinko/engine";
import type { AnyGameEngine, GameId } from "./types";
import { videoPokerGame, VIDEO_POKER_OPTIMAL_RTP, type VideoPokerOutcome } from "./videoPoker/engine";
import { wheelGame, wheelRtp, wheelRing, type WheelOutcome } from "./wheel/engine";

export interface GameInfo {
  howToPlay: string;
  /** Theoretical RTP as a fraction, or a range when it depends on settings/play. */
  rtp: number | [number, number];
  rtpNote?: string;
  probabilityModel: string;
  /** Which RNG cursors the game reads under one nonce. */
  rngUsage: string;
}

export interface GameMeta {
  id: GameId;
  name: string;
  /** Short card subtitle on the home screen. */
  tagline: string;
  engine: AnyGameEngine;
  info: GameInfo;
  /** One-line, human-readable result for history rows. */
  describe(outcome: unknown): string;
}

const def = <O>(meta: Omit<GameMeta, "describe" | "engine"> & { engine: unknown; describe: (o: O) => string }): GameMeta =>
  meta as unknown as GameMeta;

const wheelRtps = (["low", "medium", "high"] as const).map(wheelRtp);

export const GAMES: GameMeta[] = [
  def<DiceOutcome>({
    id: "dice",
    name: "Dice",
    tagline: "Over / under",
    engine: diceGame,
    info: {
      howToPlay: "Pick a target and whether the roll (0.00–99.99) lands over or under it. Lower win chance pays more.",
      rtp: GAME_RTP.dice,
      probabilityModel: "Roll is one of 10,000 equally likely values. P(under t) = t/100, P(over t) = (99.99 − t)/100. Multiplier = RTP ÷ P.",
      rngUsage: "Cursor 0 → roll = floor(float × 10000) / 100.",
    },
    describe: (o) => `Rolled ${o.roll.toFixed(2)} · ${o.direction} ${o.target.toFixed(2)}`,
  }),
  def<LimboOutcome>({
    id: "limbo",
    name: "Limbo",
    tagline: "Beat the target",
    engine: limboGame,
    info: {
      howToPlay: "Choose a target multiplier. If the generated result is at least your target you win target × bet.",
      rtp: GAME_RTP.limbo,
      probabilityModel: "Result = RTP ÷ (1 − u), floored to 2 dp. P(result ≥ t) = RTP ÷ t for every target.",
      rngUsage: "Cursor 0 → u.",
    },
    describe: (o) => `Result ${formatMultiplier(o.result)} · target ${formatMultiplier(o.target)}`,
  }),
  def<MinesOutcome>({
    id: "mines",
    name: "Mines",
    tagline: "Find the gems",
    engine: minesGame,
    info: {
      howToPlay:
        "Pick how many mines hide in the 5×5 grid, then reveal tiles. Every safe tile raises the multiplier. Cash out before you hit a mine.",
      rtp: GAME_RTP.mines,
      rtpNote: "Multipliers are truncated to 2 dp, so realised RTP is at or slightly below target.",
      probabilityModel: "P(k safe picks) = C(25 − M, k) ÷ C(25, k). Multiplier = RTP ÷ P.",
      rngUsage: "Fisher–Yates shuffle of 25 tiles using cursors 0–23; first M tiles are mines.",
    },
    describe: (o) => `${o.mineCount} mines · ${o.revealed.length} revealed${o.hitMine !== null ? " · hit mine" : ""}`,
  }),
  def<DragonTowerOutcome>({
    id: "dragonTower",
    name: "Dragon Tower",
    tagline: "Climb 9 rows",
    engine: dragonTowerGame,
    info: {
      howToPlay: "Pick one tile per row to climb. Avoid the dragons. Cash out whenever you like; clearing all 9 rows cashes out automatically.",
      rtp: GAME_RTP.dragonTower,
      rtpNote: "Multipliers are truncated to 2 dp.",
      probabilityModel: "Each row is safe with p = (tiles − dragons) ÷ tiles. After k rows P = p^k, multiplier = RTP ÷ p^k.",
      rngUsage: "Row r, dragon d uses cursor 4r + d (partial Fisher–Yates over the row's tiles).",
    },
    describe: (o) => `${o.difficulty} · ${o.picks.length} picks`,
  }),
  def<WheelOutcome>({
    id: "wheel",
    name: "Wheel",
    tagline: "Spin the ring",
    engine: wheelGame,
    info: {
      howToPlay: "Choose risk and segment count, then spin. You win the multiplier of the segment the pointer lands on.",
      rtp: [Math.min(...wheelRtps), Math.max(...wheelRtps)],
      rtpNote: "Low 96%, Medium 96%, High 97% (classic table preserved from the source game).",
      probabilityModel: "Every segment is equally likely. RTP = average multiplier on the ring.",
      rngUsage: "Cursor 0 → segment = floor(float × segments).",
    },
    describe: (o) => `${o.risk} · ${o.segments} segments · ${formatMultiplier(wheelRing(o.segments, o.risk)[o.segmentIndex])}`,
  }),
  def<FlipOutcome>({
    id: "flip",
    name: "Flip",
    tagline: "Call the streak",
    engine: flipGame,
    info: {
      howToPlay: "Pick heads or tails and a streak length. Every coin must land on your side to win.",
      rtp: GAME_RTP.flip,
      probabilityModel: "P(win) = 0.5^N. Multiplier = RTP × 2^N.",
      rngUsage: "Cursor i → flip i (float < 0.5 is heads).",
    },
    describe: (o) => `${o.side} ×${o.streak} · ${o.flips.map((f) => (f === "heads" ? "H" : "T")).join("")}`,
  }),
  def<KenoOutcome>({
    id: "keno",
    name: "Keno",
    tagline: "Pick up to 10",
    engine: kenoGame,
    info: {
      howToPlay: "Pick 1–10 numbers from 40. Ten numbers are drawn; you are paid by how many of your picks hit.",
      rtp: GAME_RTP.keno,
      rtpNote: "Payouts are truncated to 2 dp, so realised RTP is at or slightly below target.",
      probabilityModel: "P(h hits | n picks) = C(10, h)·C(30, n − h) ÷ C(40, n). Each table is scaled so Σ P × payout = RTP.",
      rngUsage: "Cursors 0–9 → partial Fisher–Yates draw of 10 numbers.",
    },
    describe: (o) => `${o.hits} of ${o.picks.length} hit`,
  }),
  def<PlinkoOutcome>({
    id: "plinko",
    name: "Plinko",
    tagline: "Drop the ball",
    engine: plinkoGame,
    info: {
      howToPlay: "Pick risk and rows, then drop. The bucket the ball lands in sets your multiplier.",
      rtp: GAME_RTP.plinko,
      rtpNote: "Payouts are truncated to 2 dp.",
      probabilityModel: "Each row is a 50/50 bounce. Bucket k has P = C(rows, k) ÷ 2^rows. Tables are scaled so Σ P × payout = RTP.",
      rngUsage: "Cursor r → row r (float < 0.5 is left). The animation replays this path; physics never decides it.",
    },
    describe: (o) => `${o.risk} · ${o.rows} rows · bucket ${o.bucket}`,
  }),
  def<HiloOutcome>({
    id: "hilo",
    name: "Hilo",
    tagline: "Higher or lower",
    engine: hiloGame,
    info: {
      howToPlay: "Guess whether the next card is higher or lower. Equal ranks lose. Skip cards for free, cash out any time.",
      rtp: GAME_RTP.hilo,
      rtpNote: "Multipliers are truncated to 2 dp.",
      probabilityModel: "Odds come from the cards still in the deck. Multiplier = RTP ÷ product of each correct guess's probability.",
      rngUsage: "Cursors 0–50 → Fisher–Yates shuffle of one 52-card deck.",
    },
    describe: (o) =>
      `${o.steps.length} cards · ${o.steps
        .map((s) => cardLabel(s.card))
        .slice(-4)
        .join(" ")}`,
  }),
  def<CrashOutcome>({
    id: "crash",
    name: "Crash",
    tagline: "Cash out in time",
    engine: crashGame,
    info: {
      howToPlay: "The multiplier climbs until it crashes. Cash out before the crash, or set an automatic cash-out.",
      rtp: GAME_RTP.crash,
      probabilityModel: "Crash point = RTP ÷ (1 − u) floored to 2 dp (1.00 if u < 1 − RTP). P(crash ≥ m) = RTP ÷ m.",
      rngUsage: "Cursor 0 → u. The crash point exists before the curve starts; animation timing never changes it.",
    },
    describe: (o) => `Crashed ${formatMultiplier(o.crashPoint)} · ${o.cashedOutAt ? `out ${formatMultiplier(o.cashedOutAt)}` : "busted"}`,
  }),
  def<BlackjackOutcome>({
    id: "blackjack",
    name: "Blackjack",
    tagline: "Beat the dealer",
    engine: blackjackGame,
    info: {
      howToPlay: "Get closer to 21 than the dealer without going over. Blackjack pays 3:2. Dealer hits soft 17. Double on any two cards, one split.",
      rtp: [0.995, 1],
      rtpNote:
        "Depends on your decisions. Basic strategy simulated at 99.996% (±0.08%, 2M rounds) under these single-deck H17 rules; mistakes lower it.",
      probabilityModel: "One freshly shuffled 52-card deck per round. Dealer peeks for blackjack.",
      rngUsage: "Cursors 0–50 → Fisher–Yates shuffle; cards are dealt from the top in order.",
    },
    describe: (o) => `${o.hands.map((h) => h.result).join(" / ")} · dealer ${o.dealer.map(cardLabel).join(" ")}`,
  }),
  def<VideoPokerOutcome>({
    id: "videoPoker",
    name: "Video Poker",
    tagline: "Jacks or Better",
    engine: videoPokerGame,
    info: {
      howToPlay: "You get five cards. Hold the ones you want, draw replacements, and get paid by the final hand (Jacks or Better, 9/6).",
      rtp: [0, VIDEO_POKER_OPTIMAL_RTP],
      rtpNote: "99.54% with perfect strategy; poorer holds return less.",
      probabilityModel: "One freshly shuffled 52-card deck per round. Replacements come from cards 6, 7, 8… in order.",
      rngUsage: "Cursors 0–50 → Fisher–Yates shuffle.",
    },
    describe: (o) => `${o.label} · ${o.final.map(cardLabel).join(" ")}`,
  }),
  def<DiamondsOutcome>({
    id: "diamonds",
    name: "Diamonds",
    tagline: "Pick 4 of 12",
    engine: diamondsGame,
    info: {
      howToPlay: "Three diamonds hide among 12 tiles. Pick 4 tiles; you are paid by how many diamonds you find (0.4× / 2× / 18×).",
      rtp: diamondsRtp(),
      rtpNote: "Classic table preserved from the source game.",
      probabilityModel: "P(h) = C(3, h)·C(9, 4 − h) ÷ C(12, 4).",
      rngUsage: "Cursors 0–2 → partial Fisher–Yates placement of 3 diamonds.",
    },
    describe: (o) => `${o.hits} of 3 diamonds`,
  }),
];

export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameMeta>;

export function getGame(id: string): GameMeta | undefined {
  return (GAME_BY_ID as Record<string, GameMeta | undefined>)[id];
}

export function formatRtp(rtp: GameInfo["rtp"]): string {
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  if (Array.isArray(rtp)) return rtp[0] === 0 ? `up to ${pct(rtp[1])}` : `${pct(rtp[0])}–${pct(rtp[1])}`;
  return pct(rtp);
}

export function formatHouseEdge(rtp: GameInfo["rtp"]): string {
  const pct = (v: number) => `${((1 - v) * 100).toFixed(2)}%`;
  if (Array.isArray(rtp)) return rtp[0] === 0 ? `from ${pct(rtp[1])}` : `${pct(rtp[1])}–${pct(rtp[0])}`;
  return pct(rtp);
}
