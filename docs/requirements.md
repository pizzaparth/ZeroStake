# Requirements: Steak

> **Historical document** — this is the original v0.1.0 planning doc, written before work started. Some of it shipped differently than planned (see [`docs/roadmap.md`](roadmap.md) for current status): real-time multiplayer Crash and the admin settings panel described below were never built, while the game library grew far beyond the original four. Kept as-is for planning history rather than edited to match reality after the fact.

## Problem Statement

Steak is a play-money social casino that offers a library of classic casino-style games with no real wagering. Players sign in, receive a configurable virtual chip balance, and play provably fair originals: Crash, Mines, Plinko, and Dice. It exists as a self-contained demo and party-game platform where there is no payment processing, no legal exposure, and no third-party casino SDK required. "Working" means: a player can register, receive a starting balance (configurable globally in settings), play all four games, and see wins and losses reflected in real time.

## Users

- **Primary**: Players — individuals who want to play casino-style games with no financial risk; includes developers evaluating the platform and friends playing at a party or event.
- **Secondary**: Admin — the operator who configures the starting balance, can top up individual accounts, and monitors activity.

## Functional Requirements

### Must-Have (v0.1.0 MVP)

- [ ] As a player, I want to register and log in with a username and password so that my balance persists across sessions.
- [ ] As a player, I want to receive a starting chip balance on account creation so that I can play immediately without any setup.
- [ ] As a player, I want to play Crash — a multiplier game where I cash out before the rocket crashes — so that I can experience the signature multiplier game in real time with other players.
- [ ] As a player, I want to play Mines — choose tiles on a grid while avoiding hidden mines — so that I can take incremental risk for incremental reward.
- [ ] As a player, I want to play Plinko — drop a ball down a pegged board — so that I can enjoy the satisfying visual RNG mechanic.
- [ ] As a player, I want to play Dice — predict whether the roll will be over or under a target — so that I can make precise, probability-driven bets.
- [ ] As a player, I want to see my current balance and recent bet history at all times so that I can track my session.
- [ ] As a player, I want provably fair verification for every bet so that I can confirm the outcome wasn't manipulated.
- [ ] As an admin, I want to configure the default starting balance (in chips) via a settings panel so that I can tune the experience without touching code.

### Nice-to-Have (v1.0+)

- [ ] As a player, I want a global leaderboard ranked by all-time profit so that competition is visible.
- [ ] As a player, I want to configure auto-bet (number of rounds, stop-on-win/loss thresholds) so that I can run strategies hands-free.
- [ ] As a player, I want a live feed of recent big wins across all games so that the lobby feels alive.
- [ ] As a player, I want to use a referral code to earn bonus chips so that I can invite friends.
- [ ] As an admin, I want to manually top up any player's balance so that I can reward or reset accounts.
- [ ] As a player, I want to toggle between light and dark mode so that the UI matches my preference.
- [ ] As a player, I want to see a full provably fair seed history and verify past bets so that I have complete auditability.

## Non-Functional Requirements

- **Performance**: Game results (Dice, Mines, Plinko) must resolve and update the UI in < 300ms. Crash game loop must broadcast state to all connected clients at ≥ 10 Hz with < 100ms server-side latency.
- **Reliability**: No game state loss on server restart — active Crash rounds must be recoverable or gracefully terminated. Balance mutations must be atomic (database transactions, no double-spend).
- **Security**: Passwords stored as bcrypt hashes (cost factor ≥ 12). Session tokens are short-lived JWTs. Balance changes only occur server-side — no client-trusted amounts. Server seeds are hashed and revealed only after the game completes (provably fair protocol).
- **Scalability**: Target: 50 concurrent players in a single Crash lobby. No horizontal scaling required for v0.1.0.

## Non-Goals

This project will NOT:

- Accept, hold, or pay out real money or cryptocurrency of any kind. This is a play-money platform only.
- Integrate with any payment processor (Stripe, Coinbase Commerce, etc.).
- Implement regulatory compliance features (KYC, AML, geo-blocking, age verification, responsible gambling limits).
- Offer slots or live dealer games — those require third-party provider integrations far outside MVP scope.
- Provide a native mobile app — the web app will be responsive, but no React Native or Expo project.
- Support multi-currency or multi-language in v0.1.0.
- Implement a real-time chat system (chat is a genre staple but is a full product in itself).

## Scope

### v0.1.0 MVP

The smallest slice that delivers the full social casino loop end-to-end:

1. Auth — register, log in, log out; starting balance on signup
2. Lobby — game grid with live player counts and last crash point
3. Crash — real-time multiplayer game with Socket.io
4. Dice — single-player, instant resolution
5. Mines — single-player, interactive grid reveal
6. Plinko — single-player, animated ball drop
7. Balance — persisted per user, updated atomically on every bet
8. Provably fair — server seed commitment + client seed + nonce per bet
9. Admin settings — configurable default starting balance

### Repo Layout

```
steak/
├── src/
│   ├── app/                    # Next.js App Router (pages, layouts, API routes)
│   │   ├── (auth)/             # Login / register pages
│   │   ├── (casino)/           # Lobby + game pages
│   │   └── api/                # REST endpoints (auth, balance, bets, admin)
│   ├── components/
│   │   ├── games/              # Crash, Dice, Mines, Plinko UI components
│   │   ├── ui/                 # shadcn/ui base components
│   │   └── layout/             # Header, sidebar, balance display
│   ├── lib/
│   │   ├── game-engine/        # Provably fair RNG + game outcome logic
│   │   ├── db/                 # Prisma client singleton
│   │   └── auth/               # NextAuth config + session helpers
│   └── server/
│       └── ws/                 # Socket.io Crash game server (standalone Node process)
├── prisma/
│   └── schema.prisma
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   └── roadmap.md
├── public/
├── .github/
│   └── workflows/
│       └── ci.yml
├── CHANGELOG.md
├── CONTRIBUTING.md
├── README.md
└── package.json
```
