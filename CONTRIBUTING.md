# Contributing to Steak

## Dev Setup

```bash
# Clone
git clone https://github.com/csimms3/steak.git
cd steak

# Install dependencies
npm install

# Run the app
npm run dev
```

The app runs at `http://localhost:3001` and works immediately as a guest (balance in `localStorage`) — no database needed for most frontend/game-engine work.

### Working on auth, balance persistence, or bet history

These require Postgres:

```bash
# Start local Postgres
docker compose up -d

# Point the app at it
cp .env.example .env

# Apply the schema and generate the Prisma client
npx prisma migrate dev
```

`NEXTAUTH_SECRET` in `.env.example` is a placeholder — fine for local dev, generate a real one (`openssl rand -base64 32`) for anything deployed.

If `docker compose` isn't an option on your machine, any local or hosted Postgres 16 instance works — just point `DATABASE_URL` at it before running the migration.

## Running Tests

```bash
# Unit tests (game engine, provably fair RNG, balance transaction logic)
npm test

# Type checking
npm run typecheck

# Lint
npm run lint
```

All three must pass before opening a PR. The test suite is pure logic tests (game engine math, `settleBet`/`reserveBet` transaction logic against a mocked Prisma client) — there's no live-database test harness, so anything requiring real Postgres behavior needs manual verification.

## Commit Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

| Prefix | When to use |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `chore:` | Maintenance (deps, config) |
| `refactor:` | Code change with no behavior change |
| `test:` | Adding or updating tests |
| `perf:` | Performance improvement |
| `ci:` | CI/CD changes |
| `BREAKING CHANGE:` | In the footer — signals a major version bump |

**Examples:**

```
feat: add Mines incremental cashout button
fix: prevent double-cashout race condition in Crash
refactor: extract provably fair seed rotation into separate module
test: add 10k simulation test for Plinko house edge
perf: cache leaderboard query in Redis with 30s TTL

feat!: rename chip unit from "credits" to "chips"

BREAKING CHANGE: all stored balance values are now labeled "chips" in API responses
```

## Opening a PR

1. Branch from `main`: `git checkout -b feat/your-feature`
2. Make your changes with conventional commits
3. Run `npm run lint && npm run typecheck && npm test` — all must pass
4. Open a PR with a clear title matching the commit format (e.g. `feat: add auto-bet for Dice`)
5. Link any related issues in the PR description

## Questions?

Open an issue or start a discussion on GitHub.
