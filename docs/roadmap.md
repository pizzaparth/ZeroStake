# Roadmap: Steak

> Milestones beyond ~3 months are intentionally high-level. Plans change — this roadmap didn't ship in its original numerical order (v0.3.0's game library shipped before v0.1.0's accounts/persistence did), and that's noted below rather than smoothed over.

## v0.1.0 — MVP

**Goal**: A fully playable social casino with provably fair games and a persistent chip balance, end-to-end.
**Status**: Mostly done, via a different path than originally planned — see v0.4.0.

| Feature | Status |
|---|---|
| User registration and login (credentials auth, bcrypt passwords) | ✅ Done (v0.4.0) |
| Persistent, server-authoritative chip balance | ✅ Done (v0.4.0) |
| Dice — instant single-player roll | ✅ Done |
| Mines — interactive grid reveal with incremental cashout | ✅ Done |
| Plinko — animated ball drop with row-based multiplier | ✅ Done |
| Crash — cash out before it crashes | ✅ Done, **single-player** (see below) |
| Per-bet provably fair verification | ✅ Done for account holders (v0.5.0); guest bets are recomputable only |
| Balance history / recent bet feed per player | ✅ Done (v0.4.0, `/history`) |
| GitHub Actions CI (lint, typecheck, test) | ✅ Done |
| Docker Compose for local development | ✅ Done, Postgres only — no WS/Redis services (see `docs/architecture.md` ADR-001) |
| Crash as **real-time multiplayer** (shared round, Socket.io) | ❌ Not done — descoped, see ADR-001 |
| Admin settings panel (configurable default starting balance) | ❌ Not done — `Settings` model exists in the schema, unused |

## v0.2.0 — Polish & Social Layer

**Goal**: Make the lobby feel alive and give players reasons to return.
**Status**: Not started.

### Features
- Global leaderboard (all-time profit)
- Live big-win feed in lobby
- Auto-bet mode for Dice and Mines (configurable rounds + stop conditions)
- Admin balance top-up for individual accounts (needs the admin panel from v0.1.0 first)
- Improved mobile responsiveness

### Done when
- Leaderboard updates in real time without polling
- Auto-bet runs 100 rounds without error or balance desync

---

## v0.3.0 — Game Library Expansion

**Goal**: Grow from 4 games to a full game library, built in tiers from simplest to most complex on the mock-balance foundation that existed at the time.
**Status**: Partially done — 9 of the 14 planned games shipped.

| Tier | Games | Status |
|---|---|---|
| Instant | Limbo, Wheel, Flip | ✅ Done |
| Multi-draw | Keno, Diamonds | ✅ Done |
| Stateful step | Hilo, Dragon Tower | ✅ Done |
| Card table | Blackjack, Video Poker | ✅ Done |
| Wheel/table classics | Roulette, Baccarat | ❌ Not built |
| Reveal/luck | Cases, Scratch, Slots | ❌ Not built |

### Foundation (done)
- Shared provably-fair card engine (`cards.ts`) — 52-card shuffle, poker hand evaluator
- Shared UI: `GameShell`, `PlayingCard`, `ResultBanner`

The remaining 5 games (Roulette, Baccarat, Cases, Scratch, Slots) are a clean continuation of the same pattern every shipped game already follows — engine + tests + route(s) + page + registration — see `CONTRIBUTING.md`.

---

## v0.4.0 — Real Accounts & Persisted Balance

**Goal**: Replace the client-only mock balance with real accounts and a server-authoritative balance, and close a real integrity gap surfaced along the way.
**Status**: Done.

### Features
- Registration and login (next-auth v5, Credentials provider, bcrypt, JWT sessions)
- Server-authoritative balance for all 13 games — every resolved bet is one atomic database transaction (`src/lib/game-balance.ts`)
- Secure server-side round state (`GameRound`) for the 6 stateful games' authenticated play, replacing the client-visible base64 blob that shipped secrets (mine positions, dealt cards, the crash point) in the clear — guest play keeps the original blob unchanged
- Crash-specific fix: server-side elapsed-time validation on cashout claims, closing the "claim near-max profit with zero elapsed time" exploit the visible-blob design allowed (residual gap documented in `docs/architecture.md`)
- Bet history (`/history`), paginated, backed by `GameSession`
- Guest mode (no account) preserved exactly as it was — zero behavior change for anyone who doesn't log in

### Done when
- ✅ All 13 games settle correctly through the authoritative path, verified end-to-end against a real Postgres instance
- ✅ Guest mode byte-identical to pre-v0.4.0 behavior
- ✅ The Crash cashout exploit (client claims a value real elapsed time couldn't support) is closed and verified via direct API testing

---

## v0.5.0 — Provably Fair Seed Pairs

**Goal**: Make account-holder outcomes actually provably fair. Until this release every route generated its server seed in the same request that received the bet and client seed, so nothing proved the seed wasn't chosen with them in view.
**Status**: Done.

### Features
- Per-player committed seed pair (`SeedPair`): next seed committed at registration, activated with a player-chosen fresh client seed, one nonce per bet, revealed on rotation (ADR-003)
- Cursor-based RNG: multi-float games draw by cursor under one nonce, so consecutive bets share no randomness
- All 13 games resolve account-holder bets on the pair. Terminal settles are one transaction with the round delete (`settleRound`)
- Settings → Seed Pair panel, first-bet auto-activation, hidden-until-rotation seed display, history reveal

### Done when
- ✅ A played bet's outcome recomputes exactly from the revealed seed, and `SHA256(revealed) ==` the hash committed before the client seed was chosen (verified end-to-end for dice, Mines and Crash against Postgres)
- ✅ Nonces stay unique and contiguous under 20 concurrent bets
- ✅ Every grinding shortcut raised in review is closed (ADR-003, "Rejected shortcuts")

---

## v1.0.0 — Stable Release

**Goal**: Production-ready. Stable public API. Full documentation. Breaking changes require a major version bump from this point.
**Status**: Not started.

### Features
- Full provably fair audit history (per-user, paginated, downloadable) — `/history` is a start, not the full ask
- Light/dark mode toggle
- Staging environment with separate DB
- Full test coverage on balance mutation paths under real concurrency (current tests mock Prisma — see `CONTRIBUTING.md`)

### Done when
- All public APIs documented
- No known P0 bugs
- Zero balance drift across large-scale simulated bet runs per game

---

## Backlog (v1.x+)

- `/verify` page: recompute any past bet in the browser from its revealed seed pair (needs the engines ported from Node `crypto` to WebCrypto)
- Round claim TTL: a round abandoned mid-game keeps its bet reserved until the player rotates their seed pair (which forfeits it), and a round whose state save fails outright stays claimed (which blocks rotation too); expire stale rounds and claims automatically
- Roulette, Baccarat, Cases, Scratch, Slots (remainder of v0.3.0's original 14)
- Real-time multiplayer Crash (shared round, live broadcast) — the one gap v0.4.0's fix doesn't fully close
- Bind the starting balance to the account: register reads it from the existing but unused `Settings` model instead of the hardcoded default and the client-supplied `startingBalance`
- Referral codes and bonus chips system
- Customizable player profile (avatar, bio)
- In-game chat (lobby-level, not per-game)
- Replay viewer for Crash rounds
- PWA / installable web app
- Multi-language support (i18n)
