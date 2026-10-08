import type { GameId, Json } from "@/games/types";
import type { Cents } from "../wallet/money";
import type { Transaction, TransactionType } from "../wallet/types";
import { getDb } from "./db";

// ─── Row types ───────────────────────────────────────────────────────────────

export interface SeedPairRow {
  id: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nextNonce: number;
  createdAt: number;
  revealedAt: number | null;
}

export interface BetRow {
  id: number;
  game: GameId;
  status: "active" | "settled";
  seedPairId: number;
  nonce: number;
  baseBet: Cents;
  totalBet: Cents;
  payout: Cents;
  /** Total return ÷ base bet (what the engine reports and verification checks). */
  multiplier: number;
  params: Json;
  actions: Json[];
  state: unknown;
  outcome: Json | null;
  createdAt: number;
  settledAt: number | null;
  /** Joined from the seed pair. */
  clientSeed: string;
  serverSeedHash: string;
  /** Only present once the pair is rotated. */
  serverSeed: string | null;
}

interface RawBet {
  id: number;
  game: string;
  status: "active" | "settled";
  seed_pair_id: number;
  nonce: number;
  base_bet: number;
  total_bet: number;
  payout: number;
  multiplier: number;
  params: string;
  actions: string;
  state: string | null;
  outcome: string | null;
  created_at: number;
  settled_at: number | null;
  client_seed: string;
  server_seed_hash: string;
  server_seed: string;
  revealed_at: number | null;
}

interface RawSeedPair {
  id: number;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  next_nonce: number;
  created_at: number;
  revealed_at: number | null;
}

const toSeedPair = (r: RawSeedPair): SeedPairRow => ({
  id: r.id,
  serverSeed: r.server_seed,
  serverSeedHash: r.server_seed_hash,
  clientSeed: r.client_seed,
  nextNonce: r.next_nonce,
  createdAt: r.created_at,
  revealedAt: r.revealed_at,
});

const toBet = (r: RawBet): BetRow => ({
  id: r.id,
  game: r.game as GameId,
  status: r.status,
  seedPairId: r.seed_pair_id,
  nonce: r.nonce,
  baseBet: r.base_bet,
  totalBet: r.total_bet,
  payout: r.payout,
  multiplier: r.multiplier,
  params: JSON.parse(r.params) as Json,
  actions: JSON.parse(r.actions) as Json[],
  state: r.state ? (JSON.parse(r.state) as unknown) : null,
  outcome: r.outcome ? (JSON.parse(r.outcome) as Json) : null,
  createdAt: r.created_at,
  settledAt: r.settled_at,
  clientSeed: r.client_seed,
  serverSeedHash: r.server_seed_hash,
  // Never expose the server seed of the active pair.
  serverSeed: r.revealed_at !== null ? r.server_seed : null,
});

const BET_SELECT = `
  SELECT b.*, s.client_seed, s.server_seed_hash, s.server_seed, s.revealed_at
  FROM bets b JOIN seed_pairs s ON s.id = b.seed_pair_id`;

// ─── Wallet ──────────────────────────────────────────────────────────────────

export function readBalance(): Cents | null {
  return getDb().getFirstSync<{ balance: number }>("SELECT balance FROM wallet WHERE id = 1")?.balance ?? null;
}

export function writeBalance(balance: Cents) {
  getDb().runSync("INSERT INTO wallet (id, balance) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET balance = excluded.balance", balance);
}

export function insertTransaction(type: TransactionType, amount: Cents, balanceAfter: Cents, betId: number | null, note: string | null = null) {
  getDb().runSync(
    "INSERT INTO transactions (type, amount, balance_after, bet_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    type,
    amount,
    balanceAfter,
    betId,
    note,
    Date.now(),
  );
}

export function listTransactions(limit = 100): Transaction[] {
  return getDb()
    .getAllSync<{
      id: number;
      type: TransactionType;
      amount: number;
      balance_after: number;
      bet_id: number | null;
      note: string | null;
      created_at: number;
    }>("SELECT * FROM transactions ORDER BY id DESC LIMIT ?", limit)
    .map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balance_after,
      betId: r.bet_id,
      note: r.note,
      createdAt: r.created_at,
    }));
}

// ─── Seed pairs ──────────────────────────────────────────────────────────────

export function readActiveSeedPair(): SeedPairRow | null {
  const r = getDb().getFirstSync<RawSeedPair>("SELECT * FROM seed_pairs WHERE revealed_at IS NULL");
  return r ? toSeedPair(r) : null;
}

export function readSeedPair(id: number): SeedPairRow | null {
  const r = getDb().getFirstSync<RawSeedPair>("SELECT * FROM seed_pairs WHERE id = ?", id);
  return r ? toSeedPair(r) : null;
}

export function listRevealedSeedPairs(limit = 50): (SeedPairRow & { betCount: number })[] {
  return getDb()
    .getAllSync<RawSeedPair & { bet_count: number }>(
      `SELECT s.*, (SELECT COUNT(*) FROM bets b WHERE b.seed_pair_id = s.id) AS bet_count
       FROM seed_pairs s WHERE revealed_at IS NOT NULL ORDER BY id DESC LIMIT ?`,
      limit,
    )
    .map((r) => ({ ...toSeedPair(r), betCount: r.bet_count }));
}

export function insertSeedPair(serverSeed: string, serverSeedHash: string, clientSeed: string): number {
  return getDb().runSync(
    "INSERT INTO seed_pairs (server_seed, server_seed_hash, client_seed, next_nonce, created_at) VALUES (?, ?, ?, 0, ?)",
    serverSeed,
    serverSeedHash,
    clientSeed,
    Date.now(),
  ).lastInsertRowId;
}

export function revealSeedPair(id: number) {
  getDb().runSync("UPDATE seed_pairs SET revealed_at = ? WHERE id = ?", Date.now(), id);
}

export function bumpNonce(id: number) {
  getDb().runSync("UPDATE seed_pairs SET next_nonce = next_nonce + 1 WHERE id = ?", id);
}

// ─── Bets ────────────────────────────────────────────────────────────────────

export interface NewBet {
  game: GameId;
  seedPairId: number;
  nonce: number;
  baseBet: Cents;
  params: Json;
  state: unknown;
}

export function insertBet(b: NewBet): number {
  return getDb().runSync(
    `INSERT INTO bets (game, status, seed_pair_id, nonce, base_bet, total_bet, params, state, created_at)
     VALUES (?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
    b.game,
    b.seedPairId,
    b.nonce,
    b.baseBet,
    b.baseBet,
    JSON.stringify(b.params),
    JSON.stringify(b.state ?? null),
    Date.now(),
  ).lastInsertRowId;
}

export function updateActiveBet(id: number, state: unknown, actions: Json[], totalBet: Cents) {
  getDb().runSync("UPDATE bets SET state = ?, actions = ?, total_bet = ? WHERE id = ?", JSON.stringify(state), JSON.stringify(actions), totalBet, id);
}

export function settleBetRow(id: number, actions: Json[], totalBet: Cents, payout: Cents, multiplier: number, outcome: Json) {
  getDb().runSync(
    `UPDATE bets SET status = 'settled', state = NULL, actions = ?, total_bet = ?, payout = ?, multiplier = ?, outcome = ?, settled_at = ?
     WHERE id = ?`,
    JSON.stringify(actions),
    totalBet,
    payout,
    multiplier,
    JSON.stringify(outcome),
    Date.now(),
    id,
  );
}

export function readBet(id: number): BetRow | null {
  const r = getDb().getFirstSync<RawBet>(`${BET_SELECT} WHERE b.id = ?`, id);
  return r ? toBet(r) : null;
}

export function readActiveBet(game: GameId): BetRow | null {
  const r = getDb().getFirstSync<RawBet>(`${BET_SELECT} WHERE b.game = ? AND b.status = 'active' ORDER BY b.id DESC`, game);
  return r ? toBet(r) : null;
}

export function countActiveBets(seedPairId: number): number {
  return getDb().getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM bets WHERE status = 'active' AND seed_pair_id = ?", seedPairId)?.n ?? 0;
}

export function listSettledBets(opts: { limit: number; offset: number; game?: GameId | null }): BetRow[] {
  const where = opts.game ? "AND b.game = ?" : "";
  const params: (string | number)[] = opts.game ? [opts.game, opts.limit, opts.offset] : [opts.limit, opts.offset];
  return getDb().getAllSync<RawBet>(`${BET_SELECT} WHERE b.status = 'settled' ${where} ORDER BY b.id DESC LIMIT ? OFFSET ?`, params).map(toBet);
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface StatsRow {
  game: GameId | null;
  bets: number;
  wins: number;
  losses: number;
  wagered: Cents;
  returned: Cents;
  highestWin: Cents;
  highestMultiplier: number;
}

const STATS_COLUMNS = `
  COUNT(*) AS bets,
  SUM(CASE WHEN payout > total_bet THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN payout < total_bet THEN 1 ELSE 0 END) AS losses,
  COALESCE(SUM(total_bet), 0) AS wagered,
  COALESCE(SUM(payout), 0) AS returned,
  COALESCE(MAX(payout - total_bet), 0) AS highestWin,
  COALESCE(MAX(CASE WHEN total_bet > 0 THEN CAST(payout AS REAL) / total_bet ELSE multiplier END), 0) AS highestMultiplier`;

export function readStats(): { overall: StatsRow; perGame: StatsRow[] } {
  const db = getDb();
  const overall = db.getFirstSync<StatsRow>(`SELECT NULL AS game, ${STATS_COLUMNS} FROM bets WHERE status = 'settled'`)!;
  const perGame = db.getAllSync<StatsRow>(`SELECT game, ${STATS_COLUMNS} FROM bets WHERE status = 'settled' GROUP BY game ORDER BY bets DESC`);
  return { overall, perGame };
}

/** Running net profit after each settled bet (most recent `limit`), oldest first. */
export function readProfitSeries(limit = 200): number[] {
  const rows = getDb().getAllSync<{ delta: number }>(
    "SELECT payout - total_bet AS delta FROM bets WHERE status = 'settled' ORDER BY id DESC LIMIT ?",
    limit,
  );
  let running = 0;
  return rows.reverse().map((r) => (running += r.delta));
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function readSettings(): Record<string, string> {
  return Object.fromEntries(
    getDb()
      .getAllSync<{ key: string; value: string }>("SELECT key, value FROM settings")
      .map((r) => [r.key, r.value]),
  );
}

export function writeSetting(key: string, value: string) {
  getDb().runSync("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
}

export function clearHistory() {
  getDb().withTransactionSync(() => {
    getDb().execSync(
      "DELETE FROM transactions WHERE bet_id IN (SELECT id FROM bets WHERE status = 'settled'); DELETE FROM bets WHERE status = 'settled';",
    );
  });
}
