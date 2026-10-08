import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import { MIGRATIONS } from "./migrations";

const DB_NAME = "zerosteak.db";

let db: SQLiteDatabase | null = null;

/**
 * The single local database. Everything (wallet, ledger, bets, seeds,
 * settings) lives here; there is no remote storage of any kind.
 *
 * The sync API is used deliberately: a bet's debit, nonce increment, outcome
 * and payout are written in one synchronous SQLite transaction, so a crash or
 * reload can never leave the balance and history out of step.
 */
export function getDb(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync(DB_NAME);
    db.execSync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    migrate(db);
  }
  return db;
}

function migrate(database: SQLiteDatabase) {
  const row = database.getFirstSync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    database.withTransactionSync(() => {
      database.execSync(MIGRATIONS[v]);
      database.execSync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
