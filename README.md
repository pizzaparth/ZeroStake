# Steak

> **Play money only. No real wagering, no real currency, no cash-out.** Steak is a social casino built purely for entertainment.

A play-money online game platform: 13 games, provably fair for account holders through a committed per-player seed pair, a custom HMAC-SHA256 RNG engine, and optional accounts with server-persisted balances, built on Next.js and Postgres.

**[Live demo](TODO: add after deploy)** · Register an account or just play as a guest — both work, see [How balance works](#how-balance-works) below.

<!-- TODO: 2-4 screenshots here once deployed — lobby, a game in progress, bet history -->

## What's here

- **13 games**: Dice, Limbo, Wheel, Flip, Keno, Diamonds, Plinko, Mines, Hilo, Dragon Tower, Blackjack, Video Poker, Crash — each with its own HMAC-SHA256 outcome engine and unit-tested payout math.
- **Provably fair, for account holders**: every result is `HMAC-SHA256(serverSeed, clientSeed:nonce:cursor)`, and the server commits to its seed before it can see anything it could grind against:
  1. The server commits a *next* server seed (publishes its SHA256) at registration, before you've chosen anything.
  2. You activate it with a client seed of your own, sending back the hash you were shown. The client seed must be new (the server rejects any it has seen), and the server never picks one for you.
  3. Each bet takes the next nonce from that pair, and games that need several random numbers (a deck shuffle, a mine layout) draw them by cursor under that one nonce.
  4. Rotating reveals the server seed, so every bet made on it can be recomputed and checked against the hash, and a new next seed is committed. Rounds still in progress are forfeited first, since revealing the seed would expose them.

  Seeds and revealed pairs are under **Settings → Seed Pair**, and each bet's seed details are in `/history`. **Guest play isn't provably fair**: each guest bet gets a fresh server seed revealed with the result, so you can recompute it, but nothing was committed beforehand. Design and rejected shortcuts: [ADR-003](docs/architecture.md#adr-003-provably-fair-rng-hmac-sha256-seed-chain). Code: [`src/lib/seed-pair.ts`](src/lib/seed-pair.ts), [`src/lib/game-engine/`](src/lib/game-engine/).
- **Real accounts, optional**: register and your balance, bet history, and game state persist server-side in Postgres. Skip it and play as a guest — balance lives in `localStorage` instead, same games, same math (but not provably fair, see above).
- **Server-authoritative money for real accounts**: once you're logged in, the server — not the client — decides your balance. Every bet is a single atomic database transaction; a stateful game's secret data (mine positions, dealt cards, the crash point) lives server-side in a `GameRound` row instead of a client-visible blob, so it can't be read or tampered with mid-round — with one necessary exception: Crash still sends `crashPoint` to the client at round start, since its countdown runs as a local client-side animation. Details in [`docs/architecture.md`](docs/architecture.md).

## Quick Start

```bash
# Clone
git clone https://github.com/csimms3/steak.git
cd steak

# Install dependencies
npm install

# Run the app
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) and start playing immediately as a guest — no setup required.

### Optional: real accounts (Postgres + auth)

To register real accounts with a server-persisted balance:

```bash
# Start local Postgres
docker compose up -d

# Point the app at it (copy the example, defaults already match docker-compose.yml)
cp .env.example .env

# Apply the schema
npx prisma migrate dev

npm run dev
```

Now `/register` creates a real account and `/login` signs in — your balance, bet history, and in-progress games persist across devices and sessions.

## How balance works

Steak runs in two modes side by side, and every game page supports both without you noticing a difference in how the game itself plays:

| | Guest | Logged in |
|---|---|---|
| Balance lives in | `localStorage` | Postgres, via the server |
| Who decides win/loss amounts | Client applies the server's computed profit | Server applies it atomically in the same request that resolves the bet |
| Stateful game secrets (mine positions, etc.) | Client-visible base64 blob | Server-side `GameRound` row, referenced by an opaque token |
| Bet history | Not tracked | `/history`, backed by `GameSession` rows |
| Outcome seeds | Fresh server seed per bet, revealed with the result (recomputable, not provably fair) | Committed per-player seed pair, revealed on rotation (provably fair) |

Guest mode is the zero-friction path — clone, run, play. Logging in switches every game route onto the server-authoritative path, no separate code path to learn as a player.

## Documentation

- [Requirements](docs/requirements.md) — original problem statement and v0.1.0 scope (historical)
- [Architecture](docs/architecture.md) — current system design, data model, and ADRs
- [Roadmap](docs/roadmap.md) — what's shipped, what's next
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
