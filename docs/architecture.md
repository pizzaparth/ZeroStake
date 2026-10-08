# Architecture: Steak

## System Overview

Steak is a Next.js 16 (App Router) application with no separate backend process — every game resolves through a Next.js API route, and the same route handles both an unauthenticated guest and a logged-in user. There is no WebSocket server and no Redis; those appeared in an earlier planning pass but were never built, and the plan changed (see ADR-001).

The app runs in two balance modes simultaneously, chosen per-request by whether a next-auth session exists:

- **Guest** — balance lives in `localStorage`. Stateful games (Mines, Hilo, Dragon Tower, Blackjack, Video Poker, Crash) pass an opaque, unsigned base64 blob back and forth between client and server to carry state across requests.
- **Authenticated** — balance lives in Postgres and is mutated server-side, inside the same transaction that resolves the bet. Stateful games' secret data (mine positions, dealt cards, the crash point) is stored server-side in a `GameRound` row instead of the blob, referenced by an opaque token the client can't decode.

Every game page and API route supports both modes without a fork in the game logic itself — see [How balance works](#balance-model) below for exactly how that's wired.

## Components

| Component | Responsibility | Technology |
|---|---|---|
| Web App | UI, routing, auth, all game API routes | Next.js 16 + TypeScript, App Router |
| Database | Users, balances, bet history, in-progress round secrets | PostgreSQL 16 + Prisma ORM |
| Auth | Credentials login, JWT sessions | NextAuth.js (Auth.js) v5 |
| Game Engine | Provably fair RNG, outcome computation for all 13 games | Shared TypeScript module (`src/lib/game-engine/`) |
| Balance | Server-authoritative debit/credit transactions | `src/lib/game-balance.ts` |
| Round Store | Server-side secret state for in-progress stateful games | `src/lib/game-engine/round-store.ts` |
| Styling | Dark, high-contrast design system | Tailwind CSS 4 |

## Balance Model

Two code paths, chosen by `auth()` inside each route handler — there's no middleware gate, each route just checks for a session and branches:

**Guest** (no session): unchanged from the original client-only MVP. Stateless games resolve and return a signed `profit`; the client applies it to a `localStorage`-backed number via `BalanceContext.applyProfit()`. Stateful games' `start` route returns a base64-encoded JSON blob containing everything needed to resume — including secrets like Mines' `minePositions` — which the client round-trips on every subsequent request.

**Authenticated** (session present): every response that resolves a bet includes a `balance` field, computed server-side. `BalanceContext.syncBalance()` sets React state directly from that field — no client-side math, no `localStorage` write. Two helpers in `src/lib/game-balance.ts` do the actual work:

- `reserveBet(userId, betAmount)` — called at a stateful game's `start`. Atomically checks and decrements balance in one guarded `UPDATE ... WHERE balance >= betAmount`, so there's no read-then-write race window under concurrent requests from the same user. Blackjack's double/split also reserves its extra stake mid-hand, always in the same transaction as the round change it pays for (saving the hand, or the final `settleRound`), so a failure can't leave the stake debited while the round reverts to its pre-action state.
- `settleBet(params)` — called at every terminal resolution (a stateless game's single route, or a stateful game's loss/cashout). Applies the balance delta and writes a `GameSession` history row in one transaction. For an already-reserved bet, the credit is `betAmount + profit` (the reservation already covered the wager); for an unreserved stateless bet, it also re-validates affordability in the same atomic update.

Stateful games' authenticated `start` route calls `createRound()` instead of building a blob — secrets go into a `GameRound` row, and the client gets back an opaque token (the row's id) instead of the blob. Subsequent requests load, and where the game's state evolves mid-round (Hilo's position/multiplier, Blackjack's hand state), update that row; the terminal request deletes it.

### Why this exists: the blob was a real integrity gap

The original base64 blob is unsigned and round-trips in the clear. For guest play that's an accepted limitation — nothing of value is at stake. But it means anyone can decode their own `state` string and read secrets meant to stay hidden until the round resolves: Mines' `minePositions`, Dragon Tower's dragon columns, even Crash's `crashPoint`. Once balance became real and persisted, shipping that unchanged would have been a genuine, easily-found exploit rather than a curiosity. Authenticated play moves that data server-side; guest play keeps the blob (see [ADR-005](#adr-005-guest-blob-vs-authenticated-round-store)).

### Crash is a special case

Crash's client runs its own local countdown animation with no server-push round loop, so `crashPoint` has to be sent to the client immediately at `start` — there's no way to run the animation otherwise. That means the blob-vs-round-store fix doesn't fully close Crash's gap: even with secrets server-side, the client still needs to *see* the crash point.

What the round-store fix *does* close for Crash: the server no longer blindly trusts whatever `cashedOutAt` the client reports at cashout. `crashMultiplierAtElapsed()` mirrors the client's own animation formula and validates a claimed cashout against real server-side elapsed time (measured from the `GameRound` row's `createdAt`), clamping any claim time couldn't support. That closes the "claim `crashPoint - 0.01` the instant the round starts" exploit. What it does *not* close: a scripted client that already knows `crashPoint` and simply waits the correct real time before claiming, since the client legitimately has the number. Fully closing that needs a server-push round loop (true real-time multiplayer Crash) — out of scope here, see [roadmap.md](roadmap.md).

## Data Model

**User**
- `id` — UUID, primary key
- `username`, `email` — unique
- `passwordHash` — bcrypt, cost 12
- `balance` — `BigInt`, minor units (1 chip = 100 units, matching the client's cents-style display convention — avoids float rounding drift over many bets)
- `role` — enum `player | admin` (present in the schema; no admin UI is wired up — see `Settings` below)
- `createdAt`
- has many `GameSession`, `GameRound`, `SeedPair`

**GameSession** — one row per resolved bet, across all 13 games
- `id`, `userId` (FK)
- `game` — enum covering all 13 games
- `betAmount`, `profit` — `BigInt`
- `multiplier` — `Float`
- `serverSeed`, `serverSeedHash`, `clientSeed`, `nonce` — the full seed record for that bet, enough to recompute the outcome
- `seedPairId` — the `SeedPair` it resolved against (null for bets from before seed pairs). `/history` shows `serverSeed` only once that pair is revealed
- `outcome` — `Json`, game-specific (revealed tiles, dealt cards, drawn numbers, …)
- `createdAt`
- Indexed on `(userId, createdAt desc)` for the history page's pagination

**GameRound** — server-side secret state for an in-progress stateful game (authenticated play only)
- `id` — cuid, doubles as the opaque client-facing token
- `userId` (FK), `game`, `betAmount`
- `payload` — `Json`, whatever that game's secret state needs (mine positions, current deck position, the crash point, …)
- `createdAt` — also used as the timing reference for Crash's elapsed-time cashout validation
- Deleted on terminal resolution, in the same transaction as the settlement (`settleRound`). If the settlement fails, the claim is released (`unclaimRound`, which never rewrites the payload) so the round stays playable. A round abandoned mid-game stays until the player rotates their seed pair, which forfeits it; otherwise nothing prunes it, and a round whose state save itself fails stays claimed (known gaps, not yet a problem at this scale)

**SeedPair** — the per-player provably-fair commitment (see ADR-003)
- `id`, `userId` (FK)
- `status` — `next` (hash published, no client seed yet) → `active` (bets draw nonces from it) → `revealed` (rotated; seed public). Partial unique indexes allow at most one `next` and one `active` per user
- `serverSeed`, `serverSeedHash`, `clientSeed` (null while `next`), `nonce` (next nonce to hand out)
- `createdAt`, `activatedAt`, `revealedAt`

**Settings** — single-row table (`defaultStartingBalance`) left over from an earlier admin-panel plan that was never built. Registration currently uses a request-supplied or hardcoded default instead of reading this row. Kept in the schema since removing it isn't worth the migration churn for an unused, harmless table; wiring it up is a fast-follow if an admin surface is ever built.

## External Integrations

None. No payment processors, no third-party game providers, no analytics SDKs. Deliberate non-goal.

## Deployment

- **App (planned)**: Heroku, deployed as a container — a multi-stage `Dockerfile` (not yet written) will build the Next.js app (`output: "standalone"` for a lean runtime image) and push to Heroku's container registry, deploying from `main` on push. Not live yet.
- **Database (planned)**: Heroku Postgres (add-on), which auto-injects `DATABASE_URL` as a config var — no manual connection-string wiring or cross-cloud firewall rules. Nothing here is Heroku-specific beyond that convenience; any Postgres 16-compatible host works.
- **CI**: GitHub Actions — lint, typecheck, test on every push and PR (`.github/workflows/ci.yml`).
- **Local dev**: `docker-compose.yml` runs Postgres only today (the app runs directly via `npm run dev`); once the Dockerfile above exists, it'll be able to build and run the whole stack locally too.

## Architecture Decision Records

### ADR-001: No separate real-time server

**Status**: Accepted (supersedes an earlier, unbuilt plan for a Socket.io sidecar)
**Context**: An earlier planning pass assumed Crash would need a persistent WebSocket process running a shared game loop, broadcasting state to every connected player. That was never built — the project shipped a much larger single-player game library instead, and real-time multiplayer Crash was explicitly descoped when this project pivoted to "make the whole story true" for a portfolio deploy rather than build the original full-multiplayer vision.
**Decision**: Every game, including Crash, resolves through ordinary Next.js API routes. Crash's live-multiplier feel comes entirely from a client-side animation timer, not a shared server round.
**Consequences**: Much simpler to build, deploy, and reason about — one process, no inter-service coordination. The tradeoff is Crash's residual cashout-timing gap described above in [Balance Model](#crash-is-a-special-case). If real-time multiplayer Crash is ever built, it's a substantial, separable addition, not a refactor of what's here.

---

### ADR-002: PostgreSQL over SQLite

**Status**: Accepted
**Context**: SQLite is tempting for a solo play-money project — zero infra. But even without real-time multiplayer, concurrent bets from the same user (e.g. two tabs) need correct transactional behavior, and a portfolio deploy benefits from demonstrating a real production-shaped database choice.
**Decision**: PostgreSQL via Prisma.
**Consequences**: Requires a running Postgres instance for anything beyond guest play (handled by `docker-compose.yml` locally, a managed instance in production). Correct behavior under concurrent writes — `reserveBet`'s guarded `UPDATE` is safe under this model in a way a naive read-then-write wouldn't be.

---

### ADR-003: Provably Fair RNG (HMAC-SHA256 Seed Chain)

**Status**: Accepted, revised in v0.5.0 (per-player seed pairs)
**Context**: Casino games — even play-money ones — should be verifiably fair. The industry-standard approach is an HMAC-SHA256 seed chain.
**Decision**: Every account-holder bet derives its outcome from `HMAC-SHA256(serverSeed, "clientSeed:nonce:cursor")` on a **per-player seed pair** (`src/lib/seed-pair.ts`), which fixes the server seed before the bet and before the client seed exist:
1. **Commit.** The server creates a `next` pair on its own only in requests that carry no bet and no client seed: registration, or `GET /api/user/seeds`. Its SHA256 is published from then on.
2. **Activate / rotate.** `POST /api/user/seeds/rotate { clientSeed, nextServerSeedHash }` pairs the committed next seed with the player's client seed and makes it `active`. It reveals the previous active pair, forfeits that pair's open rounds as losses, and commits a new next seed. The client must echo the next hash it was shown (409 on mismatch), which proves the commitment was published before the seed was chosen.
3. **Bet.** Each bet takes the next nonce from the active pair in the same transaction that settles it, or that reserves the bet and creates the round. Multi-float games draw by `cursor` under that one nonce, so consecutive bets share no randomness.
4. **Verify.** After rotation the revealed seed hashes to the published commitment, and every bet on the pair can be recomputed from `(serverSeed, clientSeed, nonce)`.

Guests keep a throwaway per-bet seed revealed with the result: recomputable, **not** provably fair.

**Consequences**:
- **Rejected shortcuts, each of which would let the server grind outcomes** (found in review on #27):
  - *Generating the client seed server-side*, even as a default: the server already knows the next seed and could search client seeds against it.
  - *Creating a pair inside a bet or rotate request*: its hash would be published only after that request's inputs were known. `allocateNonces` never creates a pair (`NoActiveSeedPairError` → 409). `rotateSeedPair` refuses without a previously committed next seed, and creates nothing when it does.
  - *Accepting a reused client seed*: the server always knows a player's earlier client seeds, so it could grind a future seed against one it expects to be reused. When the next seed is created doesn't help. Rotation rejects any client seed stored on the user's pairs, bets, or open rounds, and the UI generates a fresh one after reading the hash.
  - *Assuming a row that exists is a published commitment*: hence the echoed `nextServerSeedHash`.
- **Forfeiting on rotation**: revealing the seed would expose an open round's outcome (mine positions, deck order), and refunding would let a player cancel a round they can see going badly. Forfeits delete the round guarded on `claimedAt IS NULL` before settling it, and any claimed round makes rotation 409, so a round can't be settled twice.
- **Concurrency**: the nonce increment row-locks the active pair until the bet's transaction ends. Rotation starts by updating that row, so it waits for in-flight bets, and bets that waited on a rotation retry against the new active pair.
- Results before this change (and guest results) were seeded but not provably fair: their seed was generated in the same request as the bet.
- Deferred: a `/verify` page that recomputes bets in the browser (the engines use Node's `crypto`, so they'd need a WebCrypto port).

---

### ADR-004: Integer chip storage (no floats)

**Status**: Accepted
**Context**: Floating-point balances accumulate rounding error over many bets — a correctness bug in any financial system, real money or not.
**Decision**: All balances and bet amounts are `BigInt` minor units (1 chip = 100 units) end-to-end on the server; the client divides by 100 only at the display boundary.
**Consequences**: All arithmetic stays exact. Slight friction reading raw values in the database (`10000` means $100.00), fully eliminates balance-drift bugs.

---

### ADR-005: Guest blob vs. authenticated round store

**Status**: Accepted
**Context**: Stateful games' secret data (mine positions, dealt cards, the crash point) needs to persist across multiple requests for one round. The original, guest-only design encoded it into an unsigned base64 blob the client holds and resends — cheap, no database dependency, but readable by anyone who decodes it. That's an accepted limitation for guest play (nothing at stake) and a real integrity gap for authenticated play (real, persisted balance).
**Decision**: Keep the blob for guests exactly as it was — no behavior change, no new dependency for the zero-friction path. For authenticated users, move the same secret data into a `GameRound` Postgres row, and hand the client an opaque token (the row's id) instead of the blob itself.
**Consequences**: Two code paths per stateful route instead of one, each guarded by a small discriminated request shape (`state` XOR `token`). More surface area than a single unified design, but it means guest play needs zero new infrastructure, and authenticated play gets a real fix rather than a compromise applied to both. Crash's residual gap (see above) is the one case this ADR doesn't fully resolve, and that's called out explicitly rather than left implicit.
