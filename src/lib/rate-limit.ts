// In-memory fixed-window rate limiter, keyed by an arbitrary string (usually
// client IP). Process-local on purpose: fine for a single instance, but each
// instance keeps its own counts, so N instances allow N× the limit. Move to a
// shared store (Postgres/Redis) before scaling out.

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  // Hard cap on tracked keys, so a flood of distinct keys can't grow memory
  // without bound.
  maxKeys?: number;
  now?: () => number;
}): RateLimiter {
  // A key is (re)inserted whenever its window starts, and windowMs is fixed, so
  // Map insertion order is also resetAt order: oldest-expiring first.
  const windows = new Map<string, Window>();

  return {
    check(key) {
      const t = now();

      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
        windows.delete(key);
        // Expired windows sit at the front, so this sweep stops at the first
        // live one (amortised O(1)). If every tracked window is still live and
        // we're full, evict the oldest; it's the closest to resetting anyway.
        for (const [k, old] of windows) {
          if (old.resetAt > t && windows.size < maxKeys) break;
          windows.delete(k);
        }
        w = { count: 0, resetAt: t + windowMs };
        windows.set(key, w);
      }
      w.count++;
      return w.count <= limit ? { ok: true, retryAfterMs: 0 } : { ok: false, retryAfterMs: w.resetAt - t };
    },
  };
}

// Number of reverse proxies in front of the app that each append the address
// they saw to X-Forwarded-For (1 on Heroku or Vercel). Forwarding headers are
// client-controlled unless a trusted proxy set them, and Next only fills in the
// socket address when the header is absent, so they're ignored unless this is
// configured.
const TRUSTED_PROXY_HOPS = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10) || 0;

// Client IP as seen by the outermost trusted proxy: the entry `hops` from the
// end of X-Forwarded-For. Everything before that was supplied by the client.
// With no trusted proxy (or a short header) there is no trustworthy address,
// so every request shares one "unknown" bucket. That still caps total bcrypt
// work, it just can't tell clients apart.
export function clientIp(headers: Headers, hops = TRUSTED_PROXY_HOPS): string {
  if (hops < 1) return "unknown";
  const entries = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()) ?? [];
  return entries.at(-hops) || "unknown";
}

// bcrypt at cost 12 makes both of these a cheap CPU DoS on a small instance.
export const registerLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
export const loginLimiter = createRateLimiter({ limit: 10, windowMs: 5 * 60 * 1000 });
