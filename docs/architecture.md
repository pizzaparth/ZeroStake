# Architecture: ZeroSteak

ZeroSteak is an offline, play-money casino simulator for iOS and Android, built with Expo SDK 57, React Native and TypeScript. It has no backend and makes no network calls. Everything runs on the device.

```
React Native UI (Expo Router, HeroUI Native + Uniwind, Reanimated, Skia)
        ↓  hooks/useBetting.ts
Atomic wallet operations (engine/wallet/transactions.ts)  ── one SQLite transaction per step
        ↓
Game engines (games/*/engine.ts)  ── pure functions: seeds + params + actions → settlement
        ↓
Verifiable RNG (engine/rng)  ── HMAC-SHA256(serverSeed, clientSeed:nonce:cursor)
        ↓
Probability utilities (engine/probability)
        ↓
SQLite (engine/persistence)  ── wallet, ledger, bets, seed pairs, settings
```

## Layout

```
src/
  app/                 Expo Router routes (tabs, game/[id], bet/[id])
  screens/             Home, History, Fairness, Statistics, Settings
  components/          common/ (Swiss B/W primitives), game/ (shell, bet input, cards, tiles), layout/, animations/, fairness/
  config/              app.ts (name, currency, starting balance), rtp.ts (central RTP)
  engine/
    rng/               provablyFair.ts, byteGenerator.ts, seeds.ts, verifier.ts, secureRandom.ts
    probability/       combinatorics.ts, houseEdge.ts, expectedValue.ts, distributions.ts
    cards/             deck.ts (shuffle, blackjack values, poker ranks)
    wallet/            money.ts (integer cents), wallet.ts, transactions.ts, types.ts
    persistence/       db.ts, migrations.ts, storage.ts
  games/<id>/          engine.ts (+ payouts.ts) and <Game>Screen.tsx
  games/registry.ts    metadata, info panel text, RTP and verification hooks for all 13 games
  games/verify.ts      replay and compare
  hooks/  store/  utils/
scripts/               monte-carlo.ts, generate-sounds.mjs, generate-icons.mjs
```

## Key decisions

- **Engines are pure.** Instant games implement `play(seeds, params)`. Multi-step games implement `start` / `act` / `settle`. The same functions drive live play and verification, so a recorded bet replays exactly from its seeds and recorded actions.
- **The outcome comes first, then the animation.**
  - Plinko paths, crash points and wheel segments are fixed before anything moves.
  - Crash advances its curve on real elapsed time (`useFrameCallback`) and never on frame count. The crash point itself is fixed when the round starts.
- **Results are atomic.**
  - Each of these writes happens in one SQLite transaction: debit, nonce increment, engine call, bet row, ledger rows and payout.
  - A `UNIQUE(seed_pair_id, nonce)` constraint means a seed tuple can never be reused.
  - Unfinished rounds stay in `bets.state` and resume after a restart. Crash rounds settle on resume: auto cash-out applies if the crash point reached it, otherwise the bet is a bust.
- **The balance never spoils the result.**
  - The database holds the true balance immediately.
  - The visible balance shows only the stake leaving until the screen calls `reveal()` at the end of its animation.
  - Several reveals can overlap, for example several Plinko balls falling at once.
- **Money is integer cents.** `payoutFor(bet, multiplier)` truncates to whole cents.
- **RTP is central.** `config/rtp.ts` sets it. Keno and Plinko tables are derived from their shapes with `scalePayoutTable`, so that Σ P × payout = RTP. Wheel, Diamonds, Video Poker and Blackjack keep their classic tables, and their RTP is computed and displayed.
- **Seeds:**
  - Seeds are generated with the OS CSPRNG (`expo-crypto`).
  - Only `SHA256(serverSeed)` is shown until rotation.
  - Rotation is refused while a round on that pair is unfinished.
  - The Fairness screen states the offline trust limitation: both seeds are on the same device.
- **No outcome manipulation.** Engines never see balance, history, streaks or bet size.

## Theme

- **App chrome is light:** a solid white page, warm off-white surfaces (`#F5F3EF`) and graphite text (`#141312`). Secondary text is `#6B655E`, which passes AA contrast on white.
- **Game boards are dark insets.** They're wrapped in Uniwind `<ScopedTheme theme="dark">`, so the same tokens (`text-ink`, `bg-surface`, …) resolve to dark values there. Tokens are in `src/global.css`; raw values are in `src/config/theme.ts` (`C` for chrome, `B` for boards).
- **Accents:** chip colours (red, blue, gold, mint) for fills. Gain and loss text uses the darker `pos`/`neg` tokens for contrast. No gradients and no shadows.
- **Type:** Inter Tight throughout, with tabular figures for numbers.
- **Interaction:**
  - Every tappable element uses `PressableScale`: scale 0.97 plus a slight dim, 90 ms, run on the UI thread.
  - Tabs switch instantly, and blurred tabs are frozen (`freezeOnBlur`), so playing never re-renders background screens.
- **Balance changes** show as a solid mint or red pill dropping out under the balance. The pill sits above all other content and states the signed amount in text.
- **Web preview (dev only):** `npx expo start --web` behind COOP/COEP headers. expo-sqlite's web worker can't return large sync results, and Skia needs CanvasKit there, so History and the profit chart don't render on web. Native is unaffected.
