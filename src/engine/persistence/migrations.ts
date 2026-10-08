/**
 * Schema migrations, applied in order and tracked with PRAGMA user_version.
 * Never edit a shipped migration; append a new one instead.
 *
 * All coin amounts are INTEGER cents.
 */
export const MIGRATIONS: string[] = [
  /* 1 — initial schema */ `
  CREATE TABLE wallet (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    balance INTEGER NOT NULL CHECK (balance >= 0)
  );

  CREATE TABLE seed_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_seed TEXT NOT NULL,
    server_seed_hash TEXT NOT NULL,
    client_seed TEXT NOT NULL,
    next_nonce INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    revealed_at INTEGER
  );
  CREATE UNIQUE INDEX one_active_seed_pair ON seed_pairs (revealed_at IS NULL) WHERE revealed_at IS NULL;

  CREATE TABLE bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'settled')),
    seed_pair_id INTEGER NOT NULL REFERENCES seed_pairs(id),
    nonce INTEGER NOT NULL,
    base_bet INTEGER NOT NULL,
    total_bet INTEGER NOT NULL,
    payout INTEGER NOT NULL DEFAULT 0,
    multiplier REAL NOT NULL DEFAULT 0,
    params TEXT NOT NULL,
    actions TEXT NOT NULL DEFAULT '[]',
    state TEXT,
    outcome TEXT,
    created_at INTEGER NOT NULL,
    settled_at INTEGER,
    UNIQUE (seed_pair_id, nonce)
  );
  CREATE INDEX bets_by_time ON bets (status, created_at DESC);
  CREATE INDEX bets_by_game ON bets (game, status);

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    bet_id INTEGER REFERENCES bets(id),
    note TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX transactions_by_time ON transactions (created_at DESC);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];
