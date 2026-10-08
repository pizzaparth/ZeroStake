# This is a pre-existing code
# You are suuposed to convert this to a react native app. 
# Use amoled-black, swiss tech dark theme minimal which uses just black and white (no grey) in the UI and UX OTHER THAN GAMES.
# Name of this app will be ZeroSteak.
# Modify all of the code base. 
# Use animations
# dont code UI from scratch, use as many libraries as you can. 
# configure sqlite 
# this will be an all offile game with no backend
# set up the app such that i run npx expo run and then it shows me a qr code which i can then scan it on my phone for testing.

# ask me all the questions before stating and even during your coding sessions.

# follow this plan as well:


# Project Brief: Convert `csimms3/steak` Into a Cross-Platform Offline Mobile Casino Simulator

## 1. Objective

I am building a **forever-offline, play-money casino simulator mobile app** inspired by casino-style games such as those found on Stake Originals.

I have cloned the existing repository:

```text
csimms3/steak
```

Use this repository as the starting point.

The repository already contains implementations for the following 13 games:

```text
Dice
Limbo
Wheel
Flip
Keno
Diamonds
Plinko
Mines
Hilo
Dragon Tower
Blackjack
Video Poker
Crash
```

The existing project contains useful game logic, including:

- HMAC-SHA256 based deterministic outcomes
- probability calculations
- payout calculations
- game-specific logic
- provably-fair concepts

The goal is to transform this project into a polished **React Native mobile application for Android and iOS**.

---

# 2. Core Product Concept

This is NOT a real-money casino.

It is a completely offline simulation game.

The application must have:

- no deposits
- no withdrawals
- no cryptocurrency
- no real-money betting
- no redeemable currency
- no real-world prizes
- no gambling accounts
- no backend gambling infrastructure
- no external casino integration

The user plays entirely with **fictional virtual currency**.

Example:

```text
Starting Balance: 10,000 coins
```

Coins exist only inside the application and have no real-world monetary value.

The app should simulate realistic casino probability, house edge, payouts, game mechanics, and provably-fair verification purely for educational/entertainment purposes.

---

# 3. Technology Stack

Convert the application into:

```text
React Native
TypeScript
Expo
```

Preferred tooling:

```text
React Native
Expo
TypeScript
Expo Router
React Native Reanimated
AsyncStorage
React Native Skia if required
```

Use Expo-compatible packages wherever possible.

Avoid unnecessary native modules unless they provide a major benefit.

The application must support:

```text
Android
iOS
```

from the same codebase.

---

# 4. Offline-First Requirement

The application must function **100% offline forever**.

After installation, every game must work without an internet connection.

Do not introduce dependencies on:

```text
Firebase
Supabase
Node.js servers
REST APIs
GraphQL APIs
WebSockets
remote authentication
remote databases
cloud game logic
```

Everything should execute locally.

The app architecture should conceptually be:

```text
React Native UI
        ↓
Local Game Engine
        ↓
Provably Fair RNG
        ↓
Probability/Payout Engine
        ↓
Local Wallet
        ↓
Local Persistent Storage
```

---

# 5. Existing Repository

Before changing anything:

1. Inspect the entire repository.
2. Understand the current architecture.
3. Identify reusable game logic.
4. Identify browser-specific code.
5. Identify UI code that must be rewritten.
6. Identify packages incompatible with React Native.
7. Identify the existing RNG implementation.
8. Identify each game's payout implementation.
9. Identify how each game's HMAC-SHA256 system works.
10. Inspect the repository's license before reusing code.

Do NOT immediately rewrite everything.

Preserve reusable pure TypeScript/JavaScript game logic wherever reasonable.

Separate:

```text
game logic
```

from:

```text
React/web UI
```

and port only the UI layer where possible.

---

# 6. Application Architecture

Refactor the project toward an architecture similar to:

```text
src/
│
├── app/
│   ├── navigation/
│   ├── providers/
│   └── config/
│
├── components/
│   ├── common/
│   ├── game/
│   ├── animations/
│   └── layout/
│
├── engine/
│   │
│   ├── rng/
│   │   ├── provablyFair.ts
│   │   ├── byteGenerator.ts
│   │   ├── seeds.ts
│   │   ├── verifier.ts
│   │   └── types.ts
│   │
│   ├── probability/
│   │   ├── houseEdge.ts
│   │   ├── expectedValue.ts
│   │   ├── combinatorics.ts
│   │   └── distributions.ts
│   │
│   ├── wallet/
│   │   ├── wallet.ts
│   │   ├── transactions.ts
│   │   └── types.ts
│   │
│   └── persistence/
│       ├── storage.ts
│       └── migrations.ts
│
├── games/
│   │
│   ├── dice/
│   │   ├── engine.ts
│   │   ├── payouts.ts
│   │   ├── types.ts
│   │   └── DiceScreen.tsx
│   │
│   ├── limbo/
│   ├── wheel/
│   ├── flip/
│   ├── keno/
│   ├── diamonds/
│   ├── plinko/
│   ├── mines/
│   ├── hilo/
│   ├── dragonTower/
│   ├── blackjack/
│   ├── videoPoker/
│   └── crash/
│
├── screens/
│   ├── HomeScreen.tsx
│   ├── FairnessScreen.tsx
│   ├── HistoryScreen.tsx
│   ├── StatisticsScreen.tsx
│   └── SettingsScreen.tsx
│
├── store/
│
├── hooks/
│
├── utils/
│
└── types/
```

The exact directory structure may change if the existing repository already has a good structure.

The important requirement is strong separation of concerns.

---

# 7. Game Engine Separation

Every game must have its gameplay mathematics separated from its UI.

For example:

```text
MinesScreen
    ↓
Mines Controller
    ↓
Mines Engine
    ↓
Provably Fair RNG
```

Do NOT place probability or outcome-generation logic directly inside React components.

Game engines should preferably consist of pure functions.

For example:

```ts
createGame(...)
generateOutcome(...)
calculateProbability(...)
calculateMultiplier(...)
cashOut(...)
verifyOutcome(...)
```

This should allow each game to be independently unit tested.

---

# 8. Games

The initial application should support all games already provided by the source repository:

## Core games

```text
1. Dice
2. Limbo
3. Wheel
4. Flip
5. Keno
6. Diamonds
7. Plinko
8. Mines
9. Hilo
10. Dragon Tower
11. Blackjack
12. Video Poker
13. Crash
```

Do not remove existing games unless there is a technical reason.

Port them incrementally.

Suggested implementation priority:

```text
1. Dice
2. Limbo
3. Mines
4. Dragon Tower
5. Wheel
6. Flip
7. Keno
8. Plinko
9. Hilo
10. Crash
11. Blackjack
12. Video Poker
13. Diamonds
```

The first few games should validate the common architecture before all games are migrated.

---

# 9. Virtual Wallet

Create a global local wallet.

Example initial balance:

```text
10,000.00
```

Use fictional coins rather than a real currency symbol.

Example UI:

```text
Balance
10,000.00 Coins
```

Every bet should create a transaction.

Possible transaction types:

```ts
BET
WIN
LOSS
PAYOUT
RESET_BALANCE
BONUS
```

Maintain a locally stored transaction history.

Example:

```text
Game: Mines
Bet: 100
Multiplier: 2.43x
Payout: 243
Profit: +143
```

Persist wallet state locally.

Do not allow the balance to become inconsistent because of app reloads or navigation.

---

# 10. Balance Reset

Since this is fictional currency, provide an option such as:

```text
Reset Balance
```

or:

```text
Refill Demo Coins
```

For example:

```text
Reset balance to 10,000 coins?
```

This reinforces that the currency is fictional.

---

# 11. Probability and House Edge

A major goal of this project is to simulate realistic casino mathematics.

Do NOT invent arbitrary multipliers without understanding the probability behind them.

The app should explicitly calculate:

```text
probability
RTP
house edge
multiplier
expected value
```

where appropriate.

General relationship:

```text
House Edge = 1 - RTP
```

For games where the payout can be directly derived from event probability:

```text
Multiplier = RTP / probabilityOfWinning
```

Example:

```text
RTP = 0.99
Win probability = 0.50

Multiplier = 0.99 / 0.50
           = 1.98x
```

---

# 12. Configurable RTP

Where appropriate, centralize theoretical RTP configuration.

Example:

```ts
export const DEFAULT_RTP = 0.99;
```

Do NOT duplicate arbitrary `0.99` values throughout the codebase.

Each game may override this value when mathematically necessary.

Example configuration:

```ts
const gameConfig = {
    dice: {
        targetRtp: 0.99,
    },

    mines: {
        targetRtp: 0.99,
    },

    limbo: {
        targetRtp: 0.99,
    },

    dragonTower: {
        targetRtp: 0.98,
    },
};
```

However, preserve existing mathematically correct behavior from the repository if it intentionally uses different values.

---

# 13. Mines Mathematics

Mines should calculate probabilities using combinatorics.

For:

```text
N = number of cells
M = number of mines
k = safe selections already made
```

the probability of surviving `k` selections should derive from combinations rather than arbitrary tables.

For example:

```text
P(k safe selections)
=
C(N - M, k)
/
C(N, k)
```

The corresponding fair payout is:

```text
1 / P
```

Then apply the configured RTP/house edge.

The UI can display the next multiplier before a player selects another tile.

---

# 14. Dragon Tower Mathematics

Dragon Tower should similarly derive probabilities from:

```text
number of available cells
number of safe cells
row
difficulty
```

Avoid arbitrary multiplier tables if the multiplier can be calculated mathematically.

Support difficulty levels if appropriate, such as:

```text
Easy
Medium
Hard
Expert
Master
```

Difficulty should alter probability and therefore payout.

---

# 15. Dice

Dice should support adjustable win probability.

Possible user controls:

```text
Roll Over
Roll Under
Target
Win Chance
Multiplier
Bet Amount
```

Changing win chance should automatically change multiplier.

Use:

```text
Multiplier ≈ RTP / winProbability
```

subject to the original project's correct implementation.

---

# 16. Limbo

Limbo must use a mathematically correct multiplier distribution.

The game result must originate from deterministic RNG.

Users choose a target multiplier.

Example:

```text
Target: 3.00x
```

The player wins if the generated Limbo result is at least the target.

The expected return should match the configured theoretical RTP.

---

# 17. Plinko

Plinko must use deterministic randomness.

Do not let visual physics determine the financial/game result.

The result should be determined first by the RNG/game engine.

Then animate the ball to represent that predetermined outcome.

Conceptual process:

```text
Provably Fair RNG
      ↓
Left / Right decisions
      ↓
Final bucket
      ↓
Multiplier
      ↓
Animation visually reproduces path
```

For a simple symmetric Plinko board, bucket probabilities can derive from the binomial distribution:

```text
P(k) = C(n, k) × (0.5)^n
```

Multiplier tables must be designed so:

```text
Σ(probability × payout) ≈ target RTP
```

Support risk modes if already present or feasible:

```text
Low
Medium
High
```

and potentially different row counts.

---

# 18. Crash

Crash must use deterministic RNG and a mathematically defined crash-point distribution.

The result should exist before the animation begins.

The UI animation only visualizes the pre-generated crash multiplier.

Do not determine the crash result from animation timing or frame rate.

Support:

```text
Manual Cash Out
Auto Cash Out
```

where feasible.

---

# 19. Card Games

Games such as:

```text
Blackjack
Hilo
Video Poker
```

must use deterministic card shuffling generated from the same common random byte stream.

Do not use:

```ts
Math.random()
```

for game-critical randomness.

Deck shuffling should be reproducible given the same:

```text
server seed
client seed
nonce
cursor
```

---

# 20. Provably Fair / Verifiable RNG System

This is one of the most important aspects of the application.

Create one central deterministic random number generator that all games consume.

Use cryptographically secure primitives such as:

```text
SHA-256
HMAC-SHA256
```

The RNG system should use values such as:

```text
serverSeed
clientSeed
nonce
cursor
```

Conceptually:

```text
HMAC_SHA256(
    serverSeed,
    clientSeed + ":" + nonce + ":" + cursor
)
```

Preserve the existing repository's implementation if it already correctly follows a recognized provably-fair method.

Do not unnecessarily rewrite correct cryptographic logic.

---

# 21. Seed Commitment

The user should not initially see the active raw server seed.

Instead show:

```text
Server Seed Hash
```

where:

```text
serverSeedHash = SHA256(serverSeed)
```

This acts as a cryptographic commitment.

Example fairness interface:

```text
Client Seed
parth-example-seed

Server Seed Hash
8de6e8f8e...

Nonce
143
```

---

# 22. Seed Rotation

Create functionality:

```text
Rotate Seeds
```

When seeds are rotated:

1. Reveal the previous server seed.
2. Keep its previously published hash available.
3. Generate a new server seed.
4. Show only the hash of the new server seed.
5. Reset the nonce if appropriate.

This allows previous games to be independently verified.

---

# 23. Nonce

Each round should increment the nonce.

Example:

```text
Game 1 → nonce 0
Game 2 → nonce 1
Game 3 → nonce 2
```

Avoid accidentally reusing identical:

```text
serverSeed
clientSeed
nonce
```

combinations.

---

# 24. Cursor / Multiple Random Values

Certain games require multiple random values.

Examples:

```text
Mines
Plinko
Keno
Blackjack
Video Poker
Dragon Tower
```

Implement a deterministic byte stream using a cursor or equivalent mechanism.

A game must be able to consume as much random data as required without breaking deterministic verification.

---

# 25. Fairness Verification Screen

Create a dedicated:

```text
Fairness
```

screen.

Display things such as:

```text
Current Client Seed
Current Server Seed Hash
Current Nonce

Previous Server Seed
Previous Server Seed Hash
```

Allow the user to enter or select a previous bet and verify its result.

Example:

```text
Game:
Mines

Server Seed:
...

Client Seed:
...

Nonce:
42

Verify
```

Then show:

```text
Generated Hash
Random Bytes
Derived Outcome
Expected Game Result
Recorded Game Result

VERIFIED ✓
```

If they don't match:

```text
VERIFICATION FAILED
```

---

# 26. Important Offline Fairness Limitation

Because the application is completely offline, both the server seed and client seed physically exist on the same device.

Therefore do not falsely claim that this provides the exact same trust model as an online casino where the server controls a secret unknown to the client.

Prefer terminology such as:

```text
Provably Fair Simulation
```

or:

```text
Verifiable RNG
```

Explain that game outcomes can be independently reproduced from their seed inputs.

---

# 27. Bet History

Create a persistent history page.

Each completed game should record:

```text
Game
Timestamp
Bet amount
Payout
Profit/loss
Multiplier
Nonce
Server seed hash
Client seed
Game-specific outcome
```

Example:

```text
Mines

Bet:
100

Multiplier:
3.42x

Payout:
342

Profit:
+242

Nonce:
104
```

Allow the user to tap a historical game and open its fairness verification data.

---

# 28. Statistics

Create an offline statistics screen.

Possible values:

```text
Total Wagered
Total Won
Total Lost
Net Profit/Loss
Total Bets
Wins
Losses
Win Rate
Highest Win
Highest Multiplier
Favourite Game
Games Played
```

Also show per-game statistics.

Everything must remain local.

---

# 29. Home Screen

Create a polished casino-style home screen.

Show a grid or horizontally scrollable sections containing the games.

Example:

```text
Originals

[Mines]
[Plinko]
[Dice]
[Limbo]

[Crash]
[Dragon Tower]
[Keno]
[Wheel]

[Hilo]
[Blackjack]
[Video Poker]
[Diamonds]
```

Include:

```text
Current fictional balance
Profile/settings button
Fairness shortcut
Game history
```

---

# 30. Visual Design

Create an original visual identity.

Do NOT copy Stake's:

```text
logo
name
trademarks
exact colors
icons
artwork
proprietary assets
UI layout pixel-for-pixel
```

The application can be inspired by modern casino dashboards but must have its own identity.

Use:

```text
dark UI
high contrast
smooth animations
clear game cards
clean typography
mobile-first layouts
```

The app should feel polished rather than like a web page wrapped inside a mobile application.

---

# 31. Responsive Mobile Design

Design specifically for mobile screens.

Support:

```text
small Android phones
large Android phones
modern iPhones
devices with notches
devices with dynamic islands
safe areas
```

Avoid fixed desktop dimensions.

Use responsive layout techniques.

---

# 32. Animations

Animations should be smooth but should NEVER determine mathematical game outcomes.

Always follow:

```text
RNG determines outcome
        ↓
Game engine calculates result
        ↓
Animation displays result
```

Never:

```text
Animation/physics
        ↓
random accidental outcome
```

This distinction is especially important for:

```text
Plinko
Crash
Wheel
Dice
cards
```

---

# 33. Local Persistence

Persist:

```text
wallet balance
transaction history
bet history
statistics
settings
client seed
server seed
nonce
seed history
game preferences
```

Use something lightweight such as:

```text
AsyncStorage
```

initially.

If structured persistence becomes sufficiently complex, introduce a local SQLite database.

Do not add a remote database.

---

# 34. App Startup

The app should initialize completely offline.

Example:

```text
Launch App
    ↓
Load Local Storage
    ↓
Load Wallet
    ↓
Load RNG State
    ↓
Load User Settings
    ↓
Open Home Screen
```

If this is the first launch:

```text
Generate initial server seed
Generate default/random client seed
Set nonce = 0
Give player starting fictional balance
```

---

# 35. Security and RNG Requirements

Do not use:

```ts
Math.random()
```

for game outcomes.

Use cryptographically secure randomness when generating seeds.

Game results should then be deterministically derived from the provably-fair RNG.

Centralize all cryptographic functionality.

Add tests confirming:

```text
same seed + same nonce + same cursor
=
same output
```

every time.

---

# 36. Testing

Add unit tests for the mathematical engine.

At minimum test:

### RNG

```text
determinism
nonce handling
cursor handling
seed rotation
hash commitment
verification
```

### Probability

```text
expected payout
RTP
house edge
combinations
sampling without replacement
```

### Games

For every game:

```text
same deterministic RNG input
→ same game result
```

---

# 37. Monte Carlo Validation

Create development tests/scripts capable of simulating large numbers of rounds.

Example:

```text
1,000,000 Dice games
```

Measure:

```text
actual RTP
theoretical RTP
difference
```

Example output:

```text
Theoretical RTP: 99.0000%
Simulated RTP:   98.9943%
Difference:      -0.0057%
```

Perform similar tests for games where feasible.

These simulations must be development/testing utilities and not required during normal gameplay.

---

# 38. No Intentional Outcome Manipulation

The game engine must not modify outcomes based on:

```text
current balance
recent wins
recent losses
bet size
playtime
player behavior
winning streak
losing streak
```

Do not implement adaptive difficulty that secretly changes probabilities.

All results must come from the documented probability model and deterministic RNG.

---

# 39. Game Information

Each game should have an information panel explaining:

```text
How to Play
Theoretical RTP
House Edge
Probability Model
Provably Fair / Verification Method
```

Example:

```text
Theoretical RTP
99%

House Edge
1%
```

Do not imply guaranteed returns.

---

# 40. Navigation

Preferred main navigation:

```text
Home
History
Fairness
Statistics
Settings
```

Game screens should open independently from Home.

Use Expo Router if appropriate.

---

# 41. Settings

Provide local settings for:

```text
sound effects
haptics
animations
currency display
starting/reset balance
client seed
accessibility
```

Potential developer/debug setting:

```text
Show RNG Details
```

but keep technical information away from normal gameplay unless requested.

---

# 42. Sound and Haptics

Support optional:

```text
button haptics
win feedback
loss feedback
game sounds
background audio
```

Everything should work offline.

Provide toggles to disable them.

---

# 43. Performance

Aim for stable mobile performance.

Avoid excessive rerenders.

Pay extra attention to:

```text
Plinko animations
Crash animations
Wheel animations
large history lists
card animations
```

Use performant animation libraries where necessary.

---

# 44. Accessibility

At minimum:

```text
reasonable text contrast
touch targets large enough for mobile
screen-reader labels for important controls
do not communicate wins/losses using color alone
```

---

# 45. Store-Safe Positioning

This application should clearly present itself as:

```text
a simulated casino game
using fictional currency
for entertainment
```

Do NOT add real-money functionality.

Do NOT integrate with actual casinos.

Do NOT provide links encouraging users to wager real money.

Do NOT market fictional coins as having monetary value.

Do NOT copy casino company trademarks.

The application should be architected so that it remains a play-money simulation suitable for potential submission to:

```text
Google Play
Apple App Store
```

subject to their current review policies.

---

# 46. Naming

Do not call the app:

```text
Stake
Stake Clone
Stake Casino
```

Create temporary neutral naming until branding is chosen.

For development, use something generic such as:

```text
Offline Originals
```

or:

```text
Casino Simulator
```

Keep the name easy to replace from configuration.

---

# 47. Repository Migration Strategy

Do NOT attempt to convert all 13 games in one giant uncontrolled rewrite.

Use an incremental migration.

## Phase 1 — Audit

Inspect the repository and document:

```text
current stack
directory structure
dependencies
game engines
RNG implementation
web-only code
reusable code
licensing
```

---

## Phase 2 — React Native Foundation

Set up:

```text
React Native
Expo
TypeScript
navigation
theme
local persistence
wallet
```

Confirm Android/iOS app launches successfully.

---

## Phase 3 — Shared Engine

Extract/refactor:

```text
Provably Fair RNG
Wallet
Probability utilities
Game history
Statistics
Persistence
```

Add unit tests.

---

## Phase 4 — Dice

Port Dice first.

Verify:

```text
betting
payout
wallet
history
RNG
verification
RTP
```

The shared infrastructure should be considered stable only after Dice works correctly.

---

## Phase 5 — Additional Games

Port:

```text
Limbo
Mines
Dragon Tower
Wheel
Flip
Keno
```

Reuse shared infrastructure aggressively.

---

## Phase 6 — Animation-Heavy Games

Then port:

```text
Plinko
Crash
```

Ensure animation remains separate from outcome calculation.

---

## Phase 7 — Card Games

Then port:

```text
Hilo
Blackjack
Video Poker
```

Build a reusable deterministic deck/shuffle engine.

---

## Phase 8 — Remaining Games

Finish:

```text
Diamonds
```

and any remaining source-repository functionality.

---

# 48. Development Rules

Throughout this project:

1. Use TypeScript.
2. Avoid `any` unless genuinely required.
3. Prefer pure functions for mathematical logic.
4. Keep UI separate from game logic.
5. Keep RNG centralized.
6. Do not duplicate probability code.
7. Document non-obvious mathematics.
8. Add tests for critical probability logic.
9. Do not silently alter the house edge.
10. Never use animation to generate outcomes.
11. Never use `Math.random()` for game outcomes.
12. Preserve correct existing code instead of rewriting it for no reason.
13. Remove web-specific architecture when it no longer serves the mobile app.
14. Prefer Expo-compatible libraries.
15. Keep the application completely functional offline.

---

# 49. Important: Work With the Existing Codebase

Do not treat this as a greenfield project unless absolutely necessary.

I deliberately cloned `csimms3/steak` because its game logic, payout mathematics, and provably-fair implementations are useful.

Your job is to:

```text
understand
extract
refactor
reuse
port
improve
```

rather than blindly rebuilding everything.

However, do not preserve poor architecture solely because it already exists.

Use engineering judgment.

---

# 50. First Task

Before writing major code, perform a complete repository audit.

Give me:

```text
1. Current project architecture
2. Current framework and dependencies
3. Which files contain each game's logic
4. Where the HMAC-SHA256/provably-fair logic exists
5. Which code can be directly reused in React Native
6. Which code must be rewritten
7. Browser-specific dependencies
8. Potential React Native incompatibilities
9. Current payout/house-edge implementation
10. Current local/remote persistence model
11. Repository license implications
12. Recommended React Native migration architecture
13. Exact incremental migration plan
```

Then begin implementing the migration.

Do not rewrite all 13 games immediately.

Start by establishing the React Native foundation and shared mathematical/RNG architecture, then port **Dice as the first complete vertical slice**.

After Dice is working correctly with:

```text
UI
wallet
betting
RNG
house edge
history
persistence
fairness verification
```

use the same infrastructure for the remaining games.