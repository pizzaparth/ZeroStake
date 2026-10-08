/**
 * Development-only Monte Carlo validation. Not bundled into the app.
 *
 *   npm run simulate            # 1,000,000 rounds per scenario
 *   npm run simulate -- 200000  # custom round count
 *   npm run simulate -- 200000 blackjack  # only scenarios whose name matches
 *
 * Plays every game through the real engines with real HMAC seeds and compares
 * simulated RTP against theory.
 */
import { randomBytes } from "crypto";

import { handValue, type Card } from "../src/engine/cards/deck";
import { generateServerSeed } from "../src/engine/rng/seeds";
import type { SeedInput } from "../src/engine/rng/types";
import { blackjackGame, canDouble, canSplit, type BlackjackAction, type BlackjackState } from "../src/games/blackjack/engine";
import { crashGame } from "../src/games/crash/engine";
import { diamondsGame, diamondsRtp } from "../src/games/diamonds/engine";
import { diceGame } from "../src/games/dice/engine";
import { dragonTowerGame } from "../src/games/dragonTower/engine";
import { flipGame } from "../src/games/flip/engine";
import { hiloGame, hiloOdds } from "../src/games/hilo/engine";
import { kenoGame } from "../src/games/keno/engine";
import { limboGame } from "../src/games/limbo/engine";
import { minesGame } from "../src/games/mines/engine";
import { plinkoGame } from "../src/games/plinko/engine";
import { wheelGame, wheelRtp } from "../src/games/wheel/engine";

const N = Number(process.argv[2] ?? 1_000_000);
const FILTER = process.argv[3]?.toLowerCase();
const serverSeed = generateServerSeed((n) => new Uint8Array(randomBytes(n)));
const clientSeed = "monte-carlo";
const seeds = (nonce: number): SeedInput => ({ serverSeed, clientSeed, nonce });

function report(name: string, theoretical: number | null, run: (nonce: number) => { returned: number; staked: number }, rounds = N) {
  if (FILTER && !name.toLowerCase().includes(FILTER)) return;
  let returned = 0;
  let staked = 0;
  const t0 = Date.now();
  for (let i = 0; i < rounds; i++) {
    const r = run(i);
    returned += r.returned;
    staked += r.staked;
  }
  const sim = returned / staked;
  const pct = (v: number) => `${(v * 100).toFixed(4)}%`.padStart(10);
  const diff = theoretical === null ? "" : `  diff ${((sim - theoretical) * 100 >= 0 ? "+" : "") + ((sim - theoretical) * 100).toFixed(4)}%`;
  console.log(
    `${name.padEnd(28)} theory ${theoretical === null ? "     n/a  " : pct(theoretical)}  sim ${pct(sim)}${diff}  (${rounds.toLocaleString()} rounds, ${Date.now() - t0} ms)`,
  );
}

const instant =
  <P>(game: { play: (s: SeedInput, p: P) => { multiplier: number; stakeUnits: number } }, params: P) =>
  (n: number) => {
    const r = game.play(seeds(n), params);
    return { returned: r.multiplier, staked: r.stakeUnits };
  };

console.log(`Server seed ${serverSeed.slice(0, 16)}…  client "${clientSeed}"\n`);

report("Dice under 50", 0.99, instant(diceGame, { target: 50, direction: "under" as const }));
report("Dice over 89.99 (10%)", 0.99, instant(diceGame, { target: 89.99, direction: "over" as const }));
report("Limbo 2×", 0.99, instant(limboGame, { target: 2 }));
report("Limbo 10×", 0.99, instant(limboGame, { target: 10 }));
report("Flip ×3", 0.99, instant(flipGame, { side: "heads" as const, streak: 3 }));
report("Wheel high/30", wheelRtp("high"), instant(wheelGame, { segments: 30 as const, risk: "high" as const }));
report("Keno 5 picks", 0.99, instant(kenoGame, { picks: [3, 11, 19, 27, 35] }));
report("Plinko medium/12", 0.99, instant(plinkoGame, { rows: 12 as const, risk: "medium" as const }));
report("Plinko high/16", 0.99, instant(plinkoGame, { rows: 16 as const, risk: "high" as const }));
report("Diamonds", diamondsRtp(), instant(diamondsGame, { picks: [0, 4, 8, 11] }));

report("Crash cash-out 2×", 0.99, (n) => {
  const s = crashGame.start(seeds(n), { autoCashout: 2 });
  return { returned: crashGame.settle(crashGame.act(s, { type: "cashout", at: 2 })).multiplier, staked: 1 };
});

report("Mines 3 mines, 4 picks", 0.99, (n) => {
  let s = minesGame.start(seeds(n), { mineCount: 3 });
  for (const tile of [0, 6, 12, 18]) s = minesGame.act(s, { type: "reveal", tile });
  s = minesGame.act(s, { type: "cashout" });
  return { returned: minesGame.settle(s).multiplier, staked: 1 };
});

report("Dragon Tower medium, 3 rows", 0.99, (n) => {
  let s = dragonTowerGame.start(seeds(n), { difficulty: "medium" });
  for (let r = 0; r < 3; r++) s = dragonTowerGame.act(s, { type: "pick", col: 1 });
  s = dragonTowerGame.act(s, { type: "cashout" });
  return { returned: dragonTowerGame.settle(s).multiplier, staked: 1 };
});

report(
  "Hilo likely side ×3",
  0.99,
  (n) => {
    let s = hiloGame.start(seeds(n), {});
    for (let i = 0; i < 3 && s.status === "playing"; i++) {
      const o = hiloOdds(s);
      s = hiloGame.act(s, { type: "guess", guess: o.higher >= o.lower ? "higher" : "lower" });
    }
    s = hiloGame.act(s, { type: "cashout" });
    return { returned: hiloGame.settle(s).multiplier, staked: 1 };
  },
  Math.min(N, 300_000),
);

/** Simplified basic strategy for S17, DAS, single deck. Good enough to bound the house edge. */
function basicStrategy(s: BlackjackState): BlackjackAction {
  const hand = s.hands[s.current].cards;
  const dealer = s.dealer[0].rank === 1 ? 11 : Math.min(s.dealer[0].rank, 10);
  const { total, soft } = handValue(hand);
  const pair = (c: Card[]) => (c.length === 2 && c[0].rank === c[1].rank ? Math.min(c[0].rank, 10) : 0);
  const p = pair(hand);
  if (canSplit(s)) {
    if (p === 1 || p === 8) return { type: "split" };
    if ((p === 2 || p === 3 || p === 7) && dealer <= 7) return { type: "split" };
    if (p === 6 && dealer <= 6) return { type: "split" };
    if (p === 9 && dealer !== 7 && dealer <= 9) return { type: "split" };
  }
  if (soft) {
    if (canDouble(s) && total >= 13 && total <= 18 && dealer >= 4 && dealer <= 6) return { type: "double" };
    if (total >= 19 || (total === 18 && dealer <= 8)) return { type: "stand" };
    return { type: "hit" };
  }
  if (canDouble(s) && (total === 11 || (total === 10 && dealer <= 9) || (total === 9 && dealer >= 3 && dealer <= 6))) return { type: "double" };
  if (total >= 17) return { type: "stand" };
  if (total >= 13 && dealer <= 6) return { type: "stand" };
  if (total === 12 && dealer >= 4 && dealer <= 6) return { type: "stand" };
  return { type: "hit" };
}

report(
  "Blackjack (basic strategy)",
  null,
  (n) => {
    let s = blackjackGame.start(seeds(n), {});
    while (!blackjackGame.isFinished(s)) s = blackjackGame.act(s, basicStrategy(s));
    const r = blackjackGame.settle(s);
    // House edge is quoted per initial bet, so doubles/splits count as profit/loss, not extra stake.
    return { returned: 1 + r.multiplier - r.stakeUnits, staked: 1 };
  },
  Math.min(N, 2_000_000),
);
