import { createRateLimiter, clientIp } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  let t = 0;
  const now = () => t;
  beforeEach(() => {
    t = 0;
  });

  it("allows up to the limit, then blocks until the window resets", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now });
    expect([1, 2, 3].map(() => limiter.check("a").ok)).toEqual([true, true, true]);
    expect(limiter.check("a")).toEqual({ ok: false, retryAfterMs: 1000 });

    t = 400;
    expect(limiter.check("a")).toEqual({ ok: false, retryAfterMs: 600 });

    t = 1000;
    expect(limiter.check("a").ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now });
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("a").ok).toBe(false);
    expect(limiter.check("b").ok).toBe(true);
  });

  it("never tracks more than maxKeys, evicting the oldest live window", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now });
    limiter.check("a");
    t = 1;
    limiter.check("b");
    t = 2;
    limiter.check("c"); // full: evicts "a"
    expect(limiter.check("b").ok).toBe(false); // still tracked
    expect(limiter.check("a").ok).toBe(true); // fresh window; evicts "b"
    expect(limiter.check("c").ok).toBe(false);
  });

  it("sweeps expired windows before evicting live ones", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now });
    limiter.check("a");
    t = 500;
    limiter.check("b");
    t = 1200; // "a" has expired, "b" is live
    limiter.check("c"); // drops expired "a", keeps "b"
    expect(limiter.check("b").ok).toBe(false);
  });
});

describe("clientIp", () => {
  const xff = (v: string) => new Headers({ "x-forwarded-for": v });

  it("ignores forwarding headers when no trusted proxy is configured", () => {
    expect(clientIp(xff("1.2.3.4"), 0)).toBe("unknown");
    expect(clientIp(new Headers({ "x-real-ip": "1.2.3.4" }), 1)).toBe("unknown");
  });

  it("takes the entry added by the outermost trusted proxy, ignoring client-supplied ones", () => {
    expect(clientIp(xff("6.6.6.6, 1.2.3.4"), 1)).toBe("1.2.3.4");
    expect(clientIp(xff("6.6.6.6, 1.2.3.4, 10.0.0.1"), 2)).toBe("1.2.3.4");
  });

  it("falls back to the shared bucket when the header is missing or too short", () => {
    expect(clientIp(new Headers(), 1)).toBe("unknown");
    expect(clientIp(xff("1.2.3.4"), 2)).toBe("unknown");
  });
});
