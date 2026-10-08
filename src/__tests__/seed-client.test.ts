import { playFetch, activateSeedPair } from "@/lib/seed-client";

// Scripted fetch: each call pops the next expected request and its response.
type Step = { url: string; method?: string; status: number; body: unknown };
let script: Step[] = [];
const calls: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  script = [];
  calls.length = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const step = script.shift();
    if (!step || step.url !== url || (step.method ?? "GET") !== method) {
      throw new Error(`unexpected ${method} ${url}`);
    }
    return new Response(JSON.stringify(step.body), { status: step.status });
  }) as typeof fetch;
});

const NEXT = "a".repeat(64);
const bet = { method: "POST", body: JSON.stringify({ betAmount: 100 }) };

describe("playFetch", () => {
  test("passes ordinary responses straight through", async () => {
    script = [{ url: "/api/games/dice", method: "POST", status: 200, body: { roll: 42 } }];
    const res = await playFetch("/api/games/dice", bet);
    expect(await res.json()).toEqual({ roll: 42 });
    expect(calls).toHaveLength(1);
  });

  test("leaves other 409s alone", async () => {
    script = [{ url: "/api/games/mines/cashout", method: "POST", status: 409, body: { error: "This round has already ended." } }];
    const res = await playFetch("/api/games/mines/cashout", bet);
    expect(res.status).toBe(409);
    expect(calls).toHaveLength(1);
  });

  test("on no_active_seed_pair: loads the next hash, activates with a fresh seed, retries the bet", async () => {
    script = [
      { url: "/api/games/dice", method: "POST", status: 409, body: { code: "no_active_seed_pair" } },
      { url: "/api/user/seeds", status: 200, body: { active: null, nextServerSeedHash: NEXT, revealed: [] } },
      { url: "/api/user/seeds/rotate", method: "POST", status: 200, body: { revealed: null, forfeited: 0 } },
      { url: "/api/games/dice", method: "POST", status: 200, body: { roll: 7 } },
    ];
    const res = await playFetch("/api/games/dice", bet);
    expect(await res.json()).toEqual({ roll: 7 });
    const rotate = calls[2].body as { clientSeed: string; nextServerSeedHash: string };
    expect(rotate.nextServerSeedHash).toBe(NEXT); // the hash it was shown
    expect(rotate.clientSeed).toMatch(/^[0-9a-f]{16}$/);
  });
  test("returns the original 409 instead of throwing when activation fails", async () => {
    script = [
      { url: "/api/games/dice", method: "POST", status: 409, body: { code: "no_active_seed_pair", error: "Choose a client seed before playing." } },
      { url: "/api/user/seeds", status: 500, body: { error: "db down" } },
    ];
    const res = await playFetch("/api/games/dice", bet);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "no_active_seed_pair" });
  });
});

describe("activateSeedPair", () => {
  test("does nothing when a pair is already active", async () => {
    script = [{ url: "/api/user/seeds", status: 200, body: { active: { serverSeedHash: NEXT, clientSeed: "c", nonce: 3 }, nextServerSeedHash: NEXT, revealed: [] } }];
    await activateSeedPair();
    expect(calls).toHaveLength(1);
  });

  test("retries with a re-fetched hash and a NEW seed when the next seed changed underneath", async () => {
    const NEXT2 = "b".repeat(64);
    script = [
      { url: "/api/user/seeds", status: 200, body: { active: null, nextServerSeedHash: NEXT, revealed: [] } },
      { url: "/api/user/seeds/rotate", method: "POST", status: 409, body: { error: "Your next server seed has changed." } },
      { url: "/api/user/seeds", status: 200, body: { active: null, nextServerSeedHash: NEXT2, revealed: [] } },
      { url: "/api/user/seeds/rotate", method: "POST", status: 200, body: { revealed: null, forfeited: 0 } },
    ];
    await activateSeedPair();
    const [first, second] = [calls[1].body, calls[3].body] as { clientSeed: string; nextServerSeedHash: string }[];
    expect(second.nextServerSeedHash).toBe(NEXT2);
    expect(second.clientSeed).not.toBe(first.clientSeed); // never re-sends a seed the server has seen
  });
});
