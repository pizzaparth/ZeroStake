// Browser side of the per-player seed pair (see src/lib/seed-pair.ts for the
// protocol). Guests never hit any of this: their bets use per-bet seeds.

export interface ActivePairView {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface RevealedPairView extends ActivePairView {
  serverSeed: string;
  revealedAt: string | null;
}

export interface SeedsView {
  active: ActivePairView | null;
  nextServerSeedHash: string;
  revealed: RevealedPairView[];
}

/**
 * A fresh random client seed (Web Crypto; the engine's generator uses Node's
 * crypto). Generated at the moment of rotation, never reused: the server
 * rejects seeds it has seen, since it could have ground its next seed
 * against a known one.
 */
export function randomClientSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function fetchSeeds(): Promise<SeedsView> {
  const res = await fetch("/api/user/seeds");
  if (!res.ok) throw new Error(`Could not load seeds (${res.status})`);
  return res.json();
}

export type RotateResult =
  | { ok: true; revealed: RevealedPairView | null; forfeited: number }
  | { ok: false; status: number; error: string };

/**
 * Activates the committed next server seed with `clientSeed`. `nextServerSeedHash`
 * must be the hash the player was shown; the server refuses a mismatch.
 */
export async function rotateSeeds(clientSeed: string, nextServerSeedHash: string): Promise<RotateResult> {
  const res = await fetch("/api/user/seeds/rotate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientSeed, nextServerSeedHash }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = typeof data?.error === "string" ? data.error : "Could not rotate seeds";
    return { ok: false, status: res.status, error };
  }
  return { ok: true, revealed: data.revealed, forfeited: data.forfeited };
}

/**
 * Makes sure the player has an active pair, activating the committed next seed
 * with a fresh random client seed if not. The hash is fetched *before* the
 * seed is generated, which is the order the guarantee needs. One retry covers
 * a next seed replaced by another tab in between.
 */
export async function activateSeedPair(): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const seeds = await fetchSeeds();
    if (seeds.active) return;
    const result = await rotateSeeds(randomClientSeed(), seeds.nextServerSeedHash);
    if (result.ok) return;
  }
  throw new Error("Could not activate your seed pair");
}

/**
 * `fetch` for game routes. A logged-in player with no active seed pair gets
 * `409 no_active_seed_pair` on their first bet; this activates one and retries
 * the request once, so the first bet just works. Retrying is safe: that 409
 * comes from nonce allocation, before anything is debited or persisted.
 *
 * If activation fails, the original 409 is returned rather than thrown, so the
 * page handles it like any other error response.
 */
export async function playFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 409) return res;
  const body = await res.clone().json().catch(() => null);
  if (body?.code !== "no_active_seed_pair") return res;
  try {
    await activateSeedPair();
  } catch {
    return res;
  }
  return fetch(input, init);
}
