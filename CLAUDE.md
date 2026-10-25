# JellyCast for LG webOS

Own Jellyfin client for LG TVs, app id `nl.jellycast.webos`. Third sibling of `../jellycast-android-tv` (Chromecast, the reference implementation) and `../jellycast-ios`. Same server, same brand, same priority: smooth before pretty. Personal use only, sideloaded in Developer Mode.

Target TVs (both 2022 models upgraded via webOS Re:New; see `NOTES.md` → TVs). The build targets Chrome 108, the older of the two engines:

- **c2**: LG OLED C2 42", webOS 24, Chrome 108
- **cs**: LG OLED CS 55" (C1 casing, C2 chip), webOS 25, Chrome 120

## Starting points

- **The same app as on Android:** the same sections, pages, navigation and visual style. A concession (a lighter effect, a simpler transition) only where a measurement on the TVs shows the Android version does not stay within the budget, recorded in `NOTES.md` → "Port of the Android interface".
- **Product principles:** `../jellycast-android-tv/.claude/rules/product-principles.md` applies unchanged. **Design:** `../jellycast-android-tv/.claude/rules/design*.md` and the Paper file "jelzefin"; the TV canvas is 960×540 dp = 1920×1080 CSS px.
- **The TV does the work, the server as little as possible:** direct play for everything the TVs decode.

The Android interface is fully ported; status and what is not built yet are at the top of `NOTES.md`.

## Documents

- `NOTES.md`: status, the performance budget, decisions, open questions and results per test item on the TVs. Keep it up to date.
- `docs/tv-setup.md`: Developer Mode, connecting a TV to the CLI, installing and debugging.
- `../jellycast-ios/docs/server.md`: the Jellyfin server, the library profile and the API lessons. Read it before any network or playback work.
- `../jellycast-android-tv/docs/playback-test-matrix.md`: all test items of the playback test.
- The Android repo (code and `.claude/rules/design*.md`) is the source of truth for queries, rules, sizes and texts.

## Stack and layout

- Vite + TypeScript + Preact, plain `fetch` for the Jellyfin API. Builds for `chrome108` as one IIFE script (`app.js`): the app loads from `file://`, where Chromium refuses module scripts. `vite.config.ts` also writes `appinfo.json` with the version from `package.json`.
- Sizes in dp as in the Android app: `#app` is 960×540, zoomed 2× (`core/design/theme.css`).
- Focus is app state per screen, not DOM focus: `useKeyLayer` (`core/focus`) registers a key handler; unhandled keys go to the layer below. Holding OK gives `longEnter`.

```
src/
  app/            App (session, splash), routes, AppContext
  core/api/       client, auth, session, DTOs, mappers, image URLs
  core/data/      LibraryRepository, shelves, rankHome, settings, useLoad, backdrops
  core/design/    theme.css, icons (generated), components (buttons, cards, rows, neon, …)
  core/focus/     key layers, hooks, remote key codes
  core/i18n/      t()/plural(), strings (generated from Android), genres
  core/model/     library models and rules, segments, spine colours
  core/navigation/ the screen stack
  core/playback/  device profile, PlaybackInfo, audio choice, reporter, subtitles, tech line
  features/       auth, home, series, movies, library, seriesPage, detail, player, settings
service/          Node JS service packaged in the IPK: UDP server discovery (a web app cannot send UDP)
scripts/          import-android-resources.mjs, perf/measure-keys.mjs
```

- `node scripts/import-android-resources.mjs` copies texts, icons and the sign-in background from the Android app; never edit `src/core/i18n/strings/*.json` or `src/core/design/icons.ts` by hand.
- The webOS CLI (`@webos-tools/cli`) is a dev dependency; run it via `npx` or the npm scripts.

## Working agreements

- Everything in the repository is English: code, comments, docs, commit messages. Talk to the user in Dutch.
- Comments only for a *why* the code cannot express (a webOS or server quirk). Never log the access token or a stream URL with `api_key` (use `redactUrl`).
- Look versions up, never guess them; stable versions only. Record why a dependency was added in `NOTES.md`.
- The desktop browser and the Claude browser pane can show the UI but cannot judge playback; the pane cannot reach the LAN at all. Video always on a real TV.
- No secrets in git. The server address and account are entered in the app; the session lives in `localStorage`.
- Write what you see on a TV in `NOTES.md`: per item, per TV, with the date.

## Commands

```bash
npm run dev                  # UI in a desktop browser (http://localhost:5173)
npm run typecheck
npm test                     # Vitest: unit tests of pure playback logic
npm run package              # dist/ + service/ → build/nl.jellycast.webos_<version>_all.ipk
npm run tv:install           # to the TV named "c2"; TV=cs npm run tv:install for the other
npm run tv:launch
npm run tv:inspect           # Chrome DevTools for the app on the TV (console shows [playback-test] lines)
npx ares-setup-device --list
npx ares-device --device c2 --system-info
node scripts/perf/measure-keys.mjs c2 3   # performance budget: janky frames and key-to-paint per section
```
