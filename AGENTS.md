This is ZeroSteak, an Expo / React Native app: an offline, play-money casino simulator. There is no backend. Read `docs/architecture.md` first.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release (this project is on SDK 57). Before touching an Expo, EAS or React Native API, read the versioned docs at `https://docs.expo.dev/versions/v57.0.0/` or the index at https://docs.expo.dev/llms.txt.

## Commands

```bash
npx expo install <package>  # always use this instead of npm install for native/Expo packages
npx expo start
npm test                    # engine unit tests
npm run typecheck
npm run lint
npm run simulate -- 200000  # Monte Carlo RTP check
npx expo-doctor
```

Run typecheck, lint and tests before calling a task done.

## Project rules

- Game math lives in `src/games/<id>/engine.ts` as pure functions. Never put outcome or probability logic in components.
- All randomness for outcomes comes from `src/engine/rng`. Never use `Math.random()` for anything game-critical.
- Set RTP in `src/config/rtp.ts`; don't hard-code 0.99 in games.
- Money is integer cents (`src/engine/wallet/money.ts`).
- Wallet changes go through `src/engine/wallet/transactions.ts`, so each step happens in one SQLite transaction.
- Animations replay pre-computed outcomes. They never decide results.
- App chrome is pure black/white (no greys). Colour is allowed only inside game boards (`--color-game-*`).
- Routes live in `src/app/`. Never edit generated `ios/` or `android/` folders.
