/** The seed material one bet (or one multi-step round) resolves against. */
export interface SeedInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

/** A seed pair as the player sees it before the server seed is revealed. */
export interface SeedCommitment {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

/** Source of uniformly distributed floats in [0, 1) for one bet. */
export interface FloatStream {
  /** Float at the next cursor; advances the cursor by one. */
  next(): number;
  /** Float at an explicit cursor without moving the stream. */
  at(cursor: number): number;
  /** Cursor the next call to `next()` will read. */
  readonly cursor: number;
}
