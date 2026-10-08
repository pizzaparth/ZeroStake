/**
 * Opaque game-state codec for multi-step games (Mines, Hilo, Dragon Tower,
 * Blackjack, Video Poker). State is JSON serialised and base64 encoded so the
 * client can round-trip it on each request without a database.
 *
 * NOTE: this is the same trust model the mines routes use today — the blob is
 * NOT signed, so it is tamper-able. Production would store this server-side or
 * sign it. That hardening is tracked as a separate concern.
 */

export function encodeState<T>(state: T): string {
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

export function decodeState<T>(blob: string): T | null {
  try {
    return JSON.parse(Buffer.from(blob, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}
