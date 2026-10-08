import { createHash, createHmac, randomBytes } from "crypto";

import { createFloatStream } from "@/engine/rng/byteGenerator";
import { generateFloat, hashServerSeed, hmacHex } from "@/engine/rng/provablyFair";
import { consumeNonce, createSeedPair, rotateSeedPair, toCommitment, validateClientSeed } from "@/engine/rng/seeds";
import { traceRng, verifyCommitment } from "@/engine/rng/verifier";

const rb = (n: number) => new Uint8Array(randomBytes(n));
const seeds = { serverSeed: "a".repeat(64), clientSeed: "player-seed", nonce: 7 };

/** The original Node implementation from csimms3/steak's rng.ts, kept as a parity oracle. */
function originalGenerateOutcome(serverSeed: string, clientSeed: string, nonce: number, cursor = 0): number {
  const hmac = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:${cursor}`).digest("hex");
  return parseInt(hmac.slice(0, 8), 16) / 0x100000000;
}

describe("provably fair RNG", () => {
  test("matches the original Node crypto implementation bit for bit", () => {
    for (let i = 0; i < 300; i++) {
      const ss = Buffer.from(rb(32)).toString("hex");
      for (const cursor of [0, 1, 17, 51]) {
        expect(generateFloat(ss, `client-${i}`, i, cursor)).toBe(originalGenerateOutcome(ss, `client-${i}`, i, cursor));
      }
    }
  });

  test("hash commitment is SHA256 of the server seed text", () => {
    const ss = Buffer.from(rb(32)).toString("hex");
    expect(hashServerSeed(ss)).toBe(createHash("sha256").update(ss).digest("hex"));
    expect(verifyCommitment(ss, hashServerSeed(ss))).toBe(true);
    expect(verifyCommitment(ss, hashServerSeed(ss + "x"))).toBe(false);
  });

  test("same seed + nonce + cursor gives the same output every time", () => {
    const a = generateFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce, 3);
    for (let i = 0; i < 20; i++) expect(generateFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce, 3)).toBe(a);
  });

  test("nonce and cursor both change the output", () => {
    const base = generateFloat(seeds.serverSeed, seeds.clientSeed, 1, 0);
    expect(generateFloat(seeds.serverSeed, seeds.clientSeed, 2, 0)).not.toBe(base);
    expect(generateFloat(seeds.serverSeed, seeds.clientSeed, 1, 1)).not.toBe(base);
  });

  test("floats are in [0, 1)", () => {
    for (let n = 0; n < 2000; n++) {
      const v = generateFloat(seeds.serverSeed, seeds.clientSeed, n);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test("float stream reads sequential cursors and at() does not advance", () => {
    const stream = createFloatStream(seeds);
    expect(stream.at(5)).toBe(generateFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce, 5));
    expect(stream.cursor).toBe(0);
    const first = [stream.next(), stream.next(), stream.next()];
    expect(first).toEqual([0, 1, 2].map((c) => generateFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce, c)));
    expect(stream.cursor).toBe(3);
  });

  test("traceRng exposes the HMAC, its first 4 bytes and the float", () => {
    const [row] = traceRng(seeds, 1);
    expect(row.hmac).toBe(hmacHex(seeds.serverSeed, seeds.clientSeed, seeds.nonce, 0));
    expect(parseInt(row.bytes, 16) / 2 ** 32).toBe(row.float);
    expect(row.message).toBe("player-seed:7:0");
  });
});

describe("seed lifecycle", () => {
  test("new pair: 64-hex server seed, hash commitment, nonce 0", () => {
    const pair = createSeedPair(rb);
    expect(pair.serverSeed).toMatch(/^[0-9a-f]{64}$/);
    expect(pair.clientSeed).toMatch(/^[0-9a-f]{16}$/);
    expect(pair.nonce).toBe(0);
    expect(pair.serverSeedHash).toBe(hashServerSeed(pair.serverSeed));
    expect(toCommitment(pair)).not.toHaveProperty("serverSeed");
  });

  test("each bet consumes a unique nonce", () => {
    let pair = createSeedPair(rb);
    const used = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const { seeds: s, next } = consumeNonce(pair);
      expect(used.has(s.nonce)).toBe(false);
      used.add(s.nonce);
      pair = next;
    }
    expect(pair.nonce).toBe(50);
  });

  test("rotation reveals the old pair and starts a new one at nonce 0", () => {
    const pair = { ...createSeedPair(rb, "mine"), nonce: 42 };
    const { revealed, next } = rotateSeedPair(pair, rb);
    expect(revealed).toEqual(pair);
    expect(verifyCommitment(revealed.serverSeed, revealed.serverSeedHash)).toBe(true);
    expect(next.serverSeed).not.toBe(pair.serverSeed);
    expect(next.nonce).toBe(0);
    expect(next.clientSeed).toBe("mine");
    expect(rotateSeedPair(pair, rb, "fresh").next.clientSeed).toBe("fresh");
  });

  test("client seed validation", () => {
    expect(validateClientSeed("ok-seed")).toBeNull();
    expect(validateClientSeed("   ")).not.toBeNull();
    expect(validateClientSeed("a:b")).not.toBeNull();
    expect(validateClientSeed("x".repeat(65))).not.toBeNull();
  });
});
