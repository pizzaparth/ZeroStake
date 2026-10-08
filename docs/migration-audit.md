# Migration audit: `csimms3/steak` → ZeroSteak

This audit was done before the rewrite started. It answers the 13 questions from the project brief (§50). Line references point at the original tree, which is still available in git (`git show 76ac2bb:<path>`).

## 1. Architecture before the migration

- Next.js 16 App Router web app. The UI lives in `src/app/**/page.tsx`, and every game resolves through an API route in `src/app/api/games/**/route.ts`.
- There were two balance modes:
  - Guests kept their balance in `localStorage` and carried game state as an unsigned base64 blob.
  - Logged-in users had a server-authoritative balance in Postgres (Prisma), with secret round state stored in `GameRound` rows.
- Game math lived in `src/lib/game-engine/*.ts` as pure functions (one file per game), plus `rng.ts`, `cards.ts` and `state.ts`.

## 2. Framework and dependencies

next 16.3.6, react 19.2.4, next-auth 5 beta, prisma 6 + `@prisma/client`, bcryptjs, zod, tailwindcss 4, lucide-react, clsx, tailwind-merge, jest + ts-jest.

## 3. Where each game's logic lives

| Game | Engine | Routes |
|---|---|---|
| Dice | `lib/game-engine/dice.ts` | `api/games/dice` |
| Limbo | `limbo.ts` | `api/games/limbo` |
| Wheel | `wheel.ts` | `api/games/wheel` |
| Flip | `flip.ts` | `api/games/flip` |
| Keno | `keno.ts` | `api/games/keno` |
| Diamonds | `diamonds.ts` | `api/games/diamonds` |
| Plinko | `plinko.ts` | `api/games/plinko` |
| Mines | `mines.ts` | `api/games/mines/{start,reveal,cashout}` |
| Hilo | `hilo.ts` | `api/games/hilo/{start,guess,cashout}` |
| Dragon Tower | `dragon-tower.ts` | `api/games/dragon-tower/{start,climb,cashout}` |
| Blackjack | `blackjack.ts` + `cards.ts` | `api/games/blackjack/{start,action}` |
| Video Poker | `video-poker.ts` + `cards.ts` | `api/games/video-poker/{deal,draw}` |
| Crash | `crash.ts` | `api/games/crash/round` |

## 4. HMAC-SHA256 / provably-fair logic

- `lib/game-engine/rng.ts` computes float = first 4 bytes of `HMAC_SHA256(key = serverSeed, msg = "clientSeed:nonce:cursor")` ÷ 2³².
- Multi-value games read cursors 0, 1, 2… under one nonce.
- `lib/seed-pair.ts` handled the committed per-user seed pair: hash commitment, nonce increment, and rotation that reveals the seed.

This scheme is the standard one, so it was kept byte for byte. The port swaps Node `crypto` for `@noble/hashes`, and a test compares every output against the original Node implementation.

## 5. Code reused directly

All of the outcome math was reused:

- Fisher–Yates mine and deck shuffles, with the same cursor layout
- partial Fisher–Yates draws for Keno, Diamonds and Dragon Tower
- the Limbo and Crash distributions
- blackjack and poker hand evaluation
- the Wheel rings, Diamonds table and Video Poker 9/6 table

## 6. Code rewritten

- **UI and server:** every Next.js page and API route, auth, Prisma, `game-balance.ts`, `round-store.ts`, `seed-client.ts`, `rate-limit.ts`, the contexts, and the Tailwind web components.
- **Engine refactor:**
  - Engine functions now take `SeedInput` and return a `Settlement` instead of profit as a `bigint`.
  - Multi-step games are pure `start`/`act`/`settle` state machines, so any bet can be replayed for verification.

## 7. Browser-specific dependencies

`localStorage`, `next/*`, `react-dom`, CSS/Tailwind web classes, the `lucide-react` web icons, and canvas (the Wheel).

## 8. React Native incompatibilities

- **Node `crypto`** (`createHmac`, `randomBytes`): Hermes has no Node built-ins. Replaced with `@noble/hashes` plus `expo-crypto` (CSPRNG).
- **`Buffer`** (base64 state blobs): removed. Round state now lives in SQLite as JSON.
- **`bigint` money:** replaced with integer cents (`number`) throughout.
- **next-auth, Prisma, Postgres:** removed. There are no accounts and no server.

## 9. Payout and house-edge implementation, and what was wrong

| Game | Original | Finding | Now |
|---|---|---|---|
| Dice | 0.99 / P | P(over) used `(99 − t)/100`, but the true value is `(99.99 − t)/100` | Exact 10,000-value grid |
| Limbo, Crash | `0.99/(1−u)` | Correct | Kept |
| Mines | `0.99·C(25,k)/C(25−M,k)` | Correct | Kept, uses central RTP |
| Dragon Tower | `0.99/p` compounded per row | RTP falls to 0.99^k (91% after 9 rows) | `RTP / p^k`; added Master difficulty |
| Hilo | `0.99/(count/51)` per guess | Ignored cards already dealt, so it was exploitable by tracking cards | Exact odds from remaining deck; RTP / ∏p |
| Flip | `1.98^N` | RTP 0.99^N | `0.99 × 2^N` |
| Keno | Table "~96%" | Real RTP 36–87% for 2–10 picks (tables came from 80-ball Keno) | Hypergeometric probabilities, tables scaled to 99% |
| Plinko | "Industry tables" | high/16 missing an entry (**201% RTP**), high/12 78% | Binomial probabilities, tables scaled to 99% |
| Wheel | 96/96/97% | Intentional | Kept, RTP computed and shown |
| Diamonds | 96.7% | Intentional | Kept |
| Video Poker | 9/6 JoB | 99.54% optimal | Kept |
| Blackjack | S17, DAS, 3:2, single deck per hand | Basic strategy returned **100.21%** (player edge) | Dealer hits soft 17 → 99.996% simulated |

## 10. Persistence model

- **Before:** Postgres (accounts, `GameSession`, `GameRound`, `SeedPair`) plus guest `localStorage`.
- **Now:** one on-device SQLite database (`expo-sqlite`, sync API). Tables: `wallet`, `transactions`, `bets`, `seed_pairs` and `settings`, versioned with `PRAGMA user_version` migrations.

## 11. License

The repository has **no LICENSE file**, so by default all rights are reserved by the author. The project owner confirmed they have permission to reuse the code. Before any public or store release, get that permission in writing or add a license grant from the upstream author.

## 12. Target architecture

See `docs/architecture.md`.

## 13. Incremental plan as executed

1. Audit (this document).
2. Expo SDK 57 foundation: Router, Uniwind + HeroUI Native theme, SQLite, wallet, Zustand mirror.
3. Shared engine (RNG, probability, wallet, cards) with unit tests and a Monte Carlo script.
4. Dice as the first vertical slice: bet, payout, wallet, history, RNG, verification, RTP.
5. Limbo, Mines, Dragon Tower, Wheel, Flip, Keno.
6. Plinko and Crash, with the animation replaying a pre-computed outcome.
7. Hilo, Blackjack and Video Poker on the shared deterministic deck.
8. Diamonds.
