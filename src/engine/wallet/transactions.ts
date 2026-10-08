import { DEFAULT_STARTING_BALANCE } from "@/config/app";
import { getGame } from "@/games/registry";
import type { GameId, InstantGame, Json, RoundGame, Settlement } from "@/games/types";
import { getDb } from "../persistence/db";
import {
  bumpNonce,
  countActiveBets,
  insertBet,
  insertSeedPair,
  insertTransaction,
  readActiveBet,
  readActiveSeedPair,
  readBalance,
  readBet,
  readSeedPair,
  revealSeedPair,
  settleBetRow,
  updateActiveBet,
  writeBalance,
  type BetRow,
  type SeedPairRow,
} from "../persistence/storage";
import { createSeedPair, validateClientSeed } from "../rng/seeds";
import { secureRandomBytes } from "../rng/secureRandom";
import { payoutFor, type Cents } from "./money";
import { applyBet, applyPayout, canAfford } from "./wallet";

/**
 * Atomic betting operations. Each one runs inside a single SQLite transaction:
 * debit → nonce → engine → outcome → payout are committed together or not at all.
 *
 * Nothing here looks at balance, history or streaks when computing outcomes:
 * the engine only ever sees (seeds, params, actions).
 */

export class BetError extends Error {}

export interface BootState {
  balance: Cents;
  seedPair: SeedPairRow;
}

/** First launch: starting balance + first seed pair. Later launches: just load. */
export function bootstrap(startingBalance: Cents = DEFAULT_STARTING_BALANCE): BootState {
  const db = getDb();
  db.withTransactionSync(() => {
    if (readBalance() === null) {
      writeBalance(startingBalance);
      insertTransaction("RESET_BALANCE", startingBalance, startingBalance, null, "Starting balance");
    }
    if (!readActiveSeedPair()) {
      const pair = createSeedPair(secureRandomBytes);
      insertSeedPair(pair.serverSeed, pair.serverSeedHash, pair.clientSeed);
    }
  });
  return { balance: readBalance()!, seedPair: readActiveSeedPair()! };
}

function takeSeeds(): { pair: SeedPairRow; seeds: { serverSeed: string; clientSeed: string; nonce: number } } {
  const pair = readActiveSeedPair();
  if (!pair) throw new BetError("No active seed pair");
  bumpNonce(pair.id);
  return { pair, seeds: { serverSeed: pair.serverSeed, clientSeed: pair.clientSeed, nonce: pair.nextNonce } };
}

function debit(amount: Cents, betId: number) {
  const balance = readBalance()!;
  if (!canAfford(balance, amount)) throw new BetError("Insufficient balance");
  const after = applyBet(balance, amount);
  writeBalance(after);
  insertTransaction("BET", -amount, after, betId);
}

function settle(betId: number, baseBet: Cents, actions: Json[], settlement: Settlement<unknown>) {
  const totalBet = baseBet * settlement.stakeUnits;
  const payout = payoutFor(baseBet, settlement.multiplier);
  if (payout > 0) {
    const after = applyPayout(readBalance()!, payout);
    writeBalance(after);
    insertTransaction("PAYOUT", payout, after, betId);
  }
  settleBetRow(betId, actions, totalBet, payout, settlement.multiplier, settlement.outcome as Json);
}

function roundEngine(game: GameId) {
  const meta = getGame(game);
  if (!meta || meta.engine.kind !== "round") throw new BetError(`${game} is not a multi-step game`);
  return meta.engine as unknown as RoundGame<Json, unknown, Json, unknown>;
}

/** One-shot game: bet, resolve and pay in one transaction. */
export function playInstant(game: GameId, baseBet: Cents, params: Json): BetRow {
  const meta = getGame(game);
  if (!meta || meta.engine.kind !== "instant") throw new BetError(`${game} is not an instant game`);
  const engine = meta.engine as unknown as InstantGame<Json, unknown>;
  let betId = 0;
  getDb().withTransactionSync(() => {
    if (!canAfford(readBalance()!, baseBet)) throw new BetError("Insufficient balance");
    const { pair, seeds } = takeSeeds();
    const settlement = engine.play(seeds, params);
    betId = insertBet({ game, seedPairId: pair.id, nonce: seeds.nonce, baseBet, params, state: null });
    debit(baseBet, betId);
    settle(betId, baseBet, [], settlement);
  });
  return readBet(betId)!;
}

/** Multi-step game: debit and create the hidden round state. */
export function startRound(game: GameId, baseBet: Cents, params: Json): BetRow {
  const engine = roundEngine(game);
  let betId = 0;
  getDb().withTransactionSync(() => {
    if (readActiveBet(game)) throw new BetError("Finish the current round first");
    if (!canAfford(readBalance()!, baseBet)) throw new BetError("Insufficient balance");
    const { pair, seeds } = takeSeeds();
    const state = engine.start(seeds, params);
    betId = insertBet({ game, seedPairId: pair.id, nonce: seeds.nonce, baseBet, params, state });
    debit(baseBet, betId);
    // Some rounds end on the deal (a Blackjack natural).
    if (engine.isFinished(state)) settle(betId, baseBet, [], engine.settle(state));
  });
  return readBet(betId)!;
}

/** Applies one player action; charges extra stake (Blackjack double/split) and settles when finished. */
export function actRound(betId: number, action: Json): BetRow {
  getDb().withTransactionSync(() => {
    const bet = readBet(betId);
    if (!bet || bet.status !== "active") throw new BetError("Round is not active");
    const engine = roundEngine(bet.game);
    const before = engine.stakeUnits(bet.state);
    const next = engine.act(bet.state, action);
    const extraUnits = engine.stakeUnits(next) - before;
    if (extraUnits > 0) debit(bet.baseBet * extraUnits, betId);
    const actions = [...bet.actions, action];
    if (engine.isFinished(next)) settle(betId, bet.baseBet, actions, engine.settle(next));
    else updateActiveBet(betId, next, actions, bet.baseBet * engine.stakeUnits(next));
  });
  return readBet(betId)!;
}

export function getActiveRound(game: GameId): BetRow | null {
  return readActiveBet(game);
}

export function resetBalance(amount: Cents): Cents {
  getDb().withTransactionSync(() => {
    const before = readBalance() ?? 0;
    writeBalance(amount);
    insertTransaction("RESET_BALANCE", amount - before, amount, null, "Balance reset");
  });
  return amount;
}

/**
 * Reveals the active server seed and commits a new one (nonce back to 0).
 * Refused while a round on the current pair is unfinished, because revealing
 * the seed would expose that round's hidden outcome.
 */
export function rotateSeeds(newClientSeed?: string): { revealed: SeedPairRow; active: SeedPairRow } {
  if (newClientSeed !== undefined) {
    const error = validateClientSeed(newClientSeed);
    if (error) throw new BetError(error);
  }
  let revealedId = 0;
  getDb().withTransactionSync(() => {
    const current = readActiveSeedPair()!;
    if (countActiveBets(current.id) > 0) throw new BetError("Finish your active rounds before rotating seeds");
    revealSeedPair(current.id);
    const next = createSeedPair(secureRandomBytes, newClientSeed?.trim() ?? current.clientSeed);
    insertSeedPair(next.serverSeed, next.serverSeedHash, next.clientSeed);
    revealedId = current.id;
  });
  return { revealed: readSeedPair(revealedId)!, active: readActiveSeedPair()! };
}
