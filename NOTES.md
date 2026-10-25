# NOTES

Decisions, open questions and findings on the TVs. Newest first in each section.

## Status (2026-10-25)

Finished: the playback test, the framework choice (Preact) and the full port of the Android interface (sign-in, all four sections, series page, movie detail, player, Settings with the version), plus remote control from the iOS app (commands and play from any screen; how it works in `../jellycast-ios/docs/remote-play.md`). The concessions under "Port of the Android interface" stand as they are.

Not built, worth knowing for later:

- **Error states** are not on every screen yet (the Android rule: a message with "Try again" in place of the content, never an endless skeleton).
- **Waking the TV from the iPhone** (SSAP and Wake-on-LAN): written down in `../jellycast-ios/docs/remote-play.md`, not built.
- **Seeking** still holds the old frame 1–1.5 s; the web player offers no way around it (concession 9).
- The open questions below, which only the user can judge on the TV.

Out of scope: Live TV, music, multiple servers or profiles at once, offline, the LG Content Store.

## Performance budget (on both TVs)

| Measurement | Budget | How to measure |
|---|---|---|
| Janky frames while holding a key | < 5% of frames over 25 ms | `node scripts/perf/measure-keys.mjs <tv> 5` (`requestAnimationFrame` frame times during scripted key repeat) |
| Key to paint | p95 ≤ 50 ms | Event Timing API (`PerformanceObserver`, type `event`), same script |
| Long tasks while browsing | none over 100 ms | `PerformanceObserver`, type `longtask`, same script |
| Cold start to interactive | ≤ 3 s | from `ares-launch` to the first focused element |
| Start playback (direct play, LAN) | ≤ 3 s to first frame | `currentTime` advances |

Record every measurement with date and TV in this file. Exceeding the budget is a bug and gets fixed before new features.

## Open questions

### Still open after the first run on the C2 (2026-10-23)

- **What the eye and ear see** (only the user can judge): does the TV switch to Dolby Vision / HDR10 / HLG for the right items, does DV p7 (Ready Player One, Game of Thrones 8x6) show in DV or as HDR10, and is the AC3 fallback track audible where the file's default is TrueHD?
- **Audio track switching**: `video.audioTracks` exists and lists the tracks the TV can decode; whether setting `enabled` really switches the sound is not checked yet (GREEN in the player).
- **HLS container** `mp4` vs `ts`: only `mp4` was tried. It works (video copy, audio to AC3).
- **Wi-Fi or HDD**: Game of Thrones 1x1 (42 Mbps) stalled after a seek. Repeat before drawing conclusions.
- **Start time of audio-only transcodes**: Oppenheimer (68.8 Mbps, DTS-HD MA only) takes about 13 s to the first frame on both TVs, and a seek on the C2 about 11 s. The HDD spin-up and the remux both count; picking an AC3 track where one exists avoids it.
- **The stutter on seeking** (seen by the user) needs a solution in the real player, e.g. freeze the last frame or show a still while the player refills its buffer.
- Subtitles are out of scope for this test. PGS needs its own renderer or burn-in later.

### Developer Mode expiry

Developer Mode must be extended in its app before it runs out. Alternative: the webOS Homebrew Channel (needs a rooted TV). Decide once the app is in daily use.

## Performance budget of the ported interface (2026-10-23)

`node scripts/perf/measure-keys.mjs <tv> 5`: per scenario the arrow key held at 20 presses/s, 5 runs, median. Janky = frames over 25 ms (budget < 5%); key = Event Timing duration of the keydown up to the next paint (budget p95 ≤ 50 ms). No long task over 100 ms anywhere.

| Scenario | C2 janky / key p95 | CS janky / key p95 |
|---|---|---|
| Home ←/→ | 0% / 32 ms | 0.7% / 24 ms |
| Series ←/→ | 3.8% / 40 ms | 4.5% / 48 ms |
| Series ↑/↓ | 6.4% / 40 ms | 7.8% / 56 ms |
| Movies (detail view) ←/→ | 0.4% / 16 ms | 0% / 16 ms |
| Movies (detail view) ↑/↓ | 5.6% / 32 ms | 5.7% / 48 ms |
| Library grid | 11.7% / 104 ms → ~7% / ~50 ms with the grid as its own layer (C2) | 9.2% / 72 ms (before that change) |

What was tried, with the effect on the C2:

- **Scroll animations off while a key repeats** (`.key-repeat`, set by the key dispatcher): a single press keeps the 150 ms slide. Movies ↑/↓ 9.6% → 3–6%, Home 4.6% → 0%. Kept.
- **Backdrop and scrim as their own layers** (`will-change`), sections `memo`'d so the shelf indicator in the bar does not re-render them: part of the same gain. Kept.
- **No focus scale animation while a key repeats**: small gain. Kept.
- **All scrolling containers as their own layer**: no gain, sometimes worse (large layers cost compositing). Reverted; only the Library grid keeps it, where it lowered p95 from 88 to ~50 ms.
- Without the backdrop, or without image fades: no measurable difference (within the noise of ±2 points).
- Without the gradient focus ring (`.neon::after`): Series ↑/↓ about 2 points lower. Kept the ring, it is the focus signal.
- A trace of Series ↑/↓ shows the main thread mostly idle and the GPU thread busy (raster and drawing render passes): the limit is the TV's GPU at 1080p, not the code.

Open: Series ↑/↓ and the Library stay a few points above 5%. Android measured 5–6% (↓↑) and 12–13% (←/→) for the Series section on the Chromecast, which the user accepted (Android `NOTES.md`, "Scroll budget Series Home").

## TVs

### c2: LG OLED C2 42" (checked 2026-10-23)

- Model `OLED42C26LB`, board `O22_DVB_EU`, firmware 23.25.55, **sdkVersion 9.2.2 = webOS 24** (upgraded via webOS Re:New, not the webOS 22 it shipped with).
- Web engine **Chrome 108.0.5359.211** (`WebAppManager`). The app fills 1920×1080.
- IP `192.168.1.137`, CLI name `c2`.

### cs: LG OLED CS 55" (checked 2026-10-23)

- Model `OLED55CS6LA`, board `O22_DVB_EU`, firmware 33.31.68, **sdkVersion 10.3.1 = webOS 25** (also upgraded via webOS Re:New).
- Web engine **Chrome 120.0.6099.270**.
- IP `192.168.1.104`, CLI name `cs`.

## Decisions

### Tracks follow a hand-over between iPhone and TV (2026-10-25)

- A play from the iPhone (server `Play` message or the `jellycast://play` link) carries the audio and subtitle stream index the iPhone played; the TV starts with those instead of its own choice.
- The TV reports what plays, including a track picked in its own menu, so "Continue on iPhone" takes it over.

### Subtitle list: your languages first, then A–Z (2026-10-25)

- The server user's subtitle language, then audio language (`SubtitleLanguagePreference`, `AudioLanguagePreference`; for "han" Dutch, English) come first; the rest is sorted by name in the app's language. Within a language: plain, then SDH, then forced.
- The label is always the language. A track name from the file only shows underneath when it adds something ("Simplified"); names that repeat the language, SDH, forced or the format, release names on every track and names over 40 characters are dropped. SDH and forced become a small mark (from the file flags or the name, e.g. a track only called "SDH").
- The format (SRT, ASS) is gone; image subtitles (PGS, VobSub) are marked "Image", because the size and background settings do not apply to them.
- Tracks that still look the same get a number ("Spanish 2"): Netflix releases carry two Spanish and two Portuguese tracks (Spain/Latin America, Portugal/Brazil) without saying which is which.
- Same logic in all three apps (Android `SubtitleEntries.kt`, webOS `trackLabels.ts`, iOS `SubtitleOrder.swift`).

### Audio in the original language (2026-10-23)

Dubbed releases (~120 files, e.g. Star City, The White Lotus) mark an Italian, French or Spanish dub as the default track. Jellyfin keeps no original language, so `originalLanguage.ts` asks Wikidata: IMDb id (an episode uses its series) → P364 → ISO 639-1, one SPARQL GET (CORS `*`, also for the `file://` origin), 2.5 s timeout, cached per IMDb id for the session. `chooseAudioStream` starts from the main track in the first of: original language, English, Dutch, else the default; the Atmos/decodable rules then work within that language. Same rule as the Android TV and iOS apps. The tech line shows a codec swap within the language as a replacement, a language choice not.

### Port of the Android interface (2026-10-23)

The whole interface is ported from `../jellycast-android-tv`: sign-in (server, Quick Connect, password), Home with the section bar and the Home, Series, Movies (detail view and bookcase) and Library sections, the series page, the movie detail, the player (overlay, timebar, audio and subtitle menus, jump pill for skips and the next episode, playback info) and Settings. Data rules, thresholds and texts come straight from the Android code.

How it is built:

- **Sizes in dp, like Android.** `#app` is 960×540 and zoomed 2× (`zoom: 2`), so every value from the Android code carries over one-to-one.
- **Texts, icons and the sign-in background are imported** from the Android resources by `scripts/import-android-resources.mjs` (268 English strings, 230 per translation, 20 vector icons as SVG). Run it again when the Android texts change.
- **Roboto is bundled** (`public/fonts`, OFL, from `@fontsource/roboto`): the TV does not have it. Weight 900 maps to 700.
- **Focus is app state, not DOM focus.** Every screen keeps its own focus position and registers a key layer (`core/focus`); a layer that does not handle a key passes it to the one below (a section passes ↑ on its first row and Back to Home). Layers register in the commit (`useLayoutEffect`), so the first key after a screen opens is never lost. Holding OK gives `longEnter` after 500 ms; OK then acts on release, as on Android.
- **Every screen on the stack stays mounted** and hidden, so Back returns to the same focus and scroll position without reloading (`NavigatorHost`).
- **Data**: the repository (`core/data/library.ts`) uses the same queries, caches and next-up logic as `DefaultLibraryRepository`; `rankHome`, the shelves, `continueEpisode`, search and sort are pure functions with unit tests.
- **The tech line** uses the same PlaybackInfo request as the player, so it shows what will really happen ("DTS-HD MA → AC3 TRACK · DIRECT PLAY").

**Chrome 108 versus 120** (found by the user, 2026-10-23): the halo's glow covered the focused card and button on the CS (Chrome 120) but not on the C2 (Chrome 108). Chrome 120 ignored the SVG `feComposite out` that cut the element's own area out of the glow mask. The cut-out is now a CSS mask layer (`-webkit-mask-composite: xor` for 108, `mask-composite: exclude` for 120); checked on both TVs with screenshots. A first version cut a rectangle, which left dark corners between round buttons and their glow (also seen by the user); the cut is now the element's own rounded shape (an SVG rounded rectangle on the content box), checked on the C2. Lesson: check every visual effect on both TVs, the engines differ.

Concessions and differences from Android, chosen during the port (they stand as they are, 2026-10-25):

1. ~~No server discovery on the network.~~ Solved (2026-10-23): the IPK now carries a Node JS service (`service/`, `luna://nl.jellycast.webos.service/discover`, the same approach as jellyfin-webos) that broadcasts "who is JellyfinServer?" on UDP 7359 and answers once after 2 s. The server screen shows the last used server at once (marked current) and up to two more found ones, each with its version, like Android. Checked on the C2: the service returned "home server" (192.168.1.4:8096) in 2.6 s. The screen itself was checked in the browser pane with a mocked service; on the TV only the signed-out path reaches it. A `PalmServiceBridge` without a reference was garbage collected before its reply arrived (no callback at all), so the app keeps one until the reply.
2. **No "Advanced playback" screen.** Its options (frame rate, tunneling, passthrough per format, start delay, downmix, video level) steer Android's player and HDMI chain; the TV's own player offers none of them. Settings keeps Language, Movie view, Quality and Burn in ASS.
3. **Neon effects are approximated with GPU-only animations.** The halo turns two conic gradients behind a soft edge mask that is rendered once per size (Android: a per-pixel shader every frame); colours, lamp positions and the 7 s / 11 s turns are the same. The comet is a conic trail turning around the element's centre (on wide elements its head moves at angular, not perimeter, speed), without the weld spark and with a fixed rhythm (about 3.5 s on, 3 s off) instead of a random one. The spark on the player's timebar does not flicker.
4. **No frame rate switching.** A web app cannot choose the display mode; the TV's own setting (Real Cinema / TruMotion) decides.
5. **Subtitles**: text formats (SRT, mov_text, ASS, VTT) are fetched from the server as WebVTT and drawn by the app (plain text, size and background from the subtitle menu, like Android's simplified ASS). Image subtitles (PGS, VobSub) and ASS with Burn in on are burned in by the server, which costs a video transcode; Android draws PGS itself.
6. **No automatic fallback chain** after a playback error (Android: same plan, remux, transcode). The player shows the error screen with Retry.
7. **Screen changes are direct**, without Android's 200 ms crossfade (the design allows "fade ≤ 250 ms or none").
8. **The playback info panel is shorter**: play method with reasons, video range and audio, no decoder or dropped frames (the web player does not expose them).
9. **Seeking lands on the nearest keyframe, and the TV pauses 1–1.5 s.** Measured on the C2 (2026-10-23), direct play: the TV's player always seeks to the keyframe *before* the requested time (a map around 600 s of one file: keyframes at 599.0, 604.2 and 610.0 s; requests 600–604 all land on 599.0), so a jump replayed up to 6.7 s the user meant to skip, and the timebar jumped back. It also holds the old frame for 1.1–1.6 s before playing on: that is the stutter the user saw, and the web player offers no way around it (LG's `mediaOption` has no seek mode; no trickplay images on the server). Now `KeyframeSeek` learns the keyframe spacing from where seeks land and asks for half a spacing later, so a seek lands on the nearest keyframe (as Android's `CLOSEST_SYNC`): five jumps landed −2.0, −0.6, +0.2, −5.1 and −2.5 s from the target (before: −5 to −6.7 s every time; the −5.1 s is a stretch with sparse keyframes). Until the picture moves again the timebar stays on the target with the large "seeking" spark and the overlay stays up, so the held frame reads as busy, not stuck. Not for HLS transcodes: there the server decides.

Checked on the C2 (2026-10-23), via DevTools screenshots of the web layer (the video itself is on a hardware plane and not in the screenshots): sign-in with Quick Connect, all four sections, both Movies views, Library, series page, Settings, the player overlay, text subtitles (English SRT in sync), the next-episode pill with countdown (S1·E3 → E4 started by itself), progress reporting (Home showed "Continue watching" right after stopping). Checked later the same day on the C2 (the CS is the user's own TV now; test only on the C2):

- **Magic Remote pointer**: hovering a tile, chip or button focuses it, clicking opens it, and an arrow key afterwards continues from there. Fixed: the pointer over a section's content now takes the focus from the section bar (before, the hovered tile showed no focus), and the Library no longer overrides a pointed element with its "↓ from the bar → chip" rule.
- **Audio menu** (Game of Thrones 8x6, 17 tracks): choosing the French AC3 track switches in place via `audioTracks` (direct play continues); choosing TrueHD re-plans: the server copies the video and converts only the audio to AC3, playback continues at the same position. Fixed: the menu showed each track's title, which in this file is the release name on all 17 tracks; tracks are now named by language, with the title only when it is short and differs between tracks (`trackLabels.ts`, tested).
- **PGS subtitles**: the server burns them in (video encoded to HEVC at ~40 fps on the N150); playback starts after **~15–20 s** while the encode starts, then runs. "Off" returns to the previous plan.
- **Skip pill** (Band of Brothers 1x1, recap 0–116 s): "Skip recap" appears with the focus, OK jumps to the end of the recap.
- Fixed: during the comet's pause (it shows about half the time) a focused chip, button or pill had no visible focus at all; the static ring now stays under the comet, as Android keeps its white selection ring.


### UI framework: Preact (2026-10-23)

Phase 1 benchmark: one Home-like measuring page (backdrop, 6 rows × 24 posters at 240×360 px, focused card at a fixed place) built in plain DOM, Preact 11 and React 19 with Enact Spotlight 5.6. A driver held the arrow keys over the DevTools protocol (20 presses/s, `Input.dispatchKeyEvent`), 5 runs per scenario, two rounds per variant, on both TVs. Final round, with the hero updating only after 300 ms of rest as in the Android design:

| | DOM | Preact | Enact |
|---|---|---|---|
| Janky frames (> 25 ms) ←/→, C2 / CS | 0% / 0.1–0.4% | 0% / 0.4% | 0.7% / 1.7–2.2% |
| Janky frames ↑/↓, C2 / CS | 2.7–9.9% / 5.3–7.6% | 4.9–5.6% / 7.3–8.1% | 0.7–2.4% / 3.3–4.0% |
| Key to paint p50 ↑/↓ | 40–48 ms | 32 ms | 24–32 ms |
| Ready after navigation start | ~240 ms | ~330 ms | 550–780 ms |
| Bundle (gzip) | 6 KB | 13 KB | 102 KB |

No variant had a long task; no key was lost and the focus always ended where expected.

What the numbers say:

- The framework itself is not the bottleneck: ←/→ is smooth everywhere, and ↑/↓ differences come from what a vertical move triggers, not from rendering. An experiment on the DOM variant (C2, ↑/↓): 13.9% janky frames by default, 4.2% without updating the hero title per key, 7.6% without the 150 ms CSS transitions, **0.6% without both**. The first runs updated the hero title on every key; the Android design does that only after 300 ms of rest, which halved the jank.
- Enact's lower ↑/↓ jank comes from Spotlight moving real DOM focus; it costs ←/→ smoothness, start time (2–3×) and 340 KB, and its geometric navigation would have to be overridden for every rule of `design-navigation.md` (entering a row = item 1, no wrap-around, Back to the item you came from). Its UI kit (Sandstone) is LG's look, not JellyCast's.

**Chosen: Preact** with an own focus system that implements the Android navigation rules. Components keep the many screens readable (plain DOM would not), at 13 KB and ~330 ms to ready. Measured consequence for the port: vertical moves must not animate several large layers at once; the row change is the first place to make a concession if ↑/↓ exceeds the 5% budget in the real app. The driver lives on as `scripts/perf/measure-keys.mjs`.


### Project setup (2026-10-23)

- **Vite 8 + TypeScript 7, no UI framework** for the test app. The framework choice (Enact with its Spotlight focus system, Preact, or plain DOM) waits until the real UI starts.
- **Plain `fetch` instead of `@jellyfin/sdk`**: the test needs six endpoints; the SDK adds axios and generated code for a 2022 Chromium. Revisit when the API surface grows.
- **One IIFE bundle**: webOS loads the app from `file://`, where module scripts are refused.
- **Build target `chrome108`** (raised from `chrome87` on 2026-10-23): the C2 runs Chrome 108, the CS Chrome 120.
- **Dev dependencies**: `vite`, `typescript`, `@webos-tools/cli` (the `ares-*` commands, as a project dependency so no global install is needed).
- **DeviceProfile** (`src/playback/deviceProfile.ts`): direct play mkv/mp4/mov/ts/webm with H.264, HEVC, VP9, AV1 and every audio codec except DTS and TrueHD (both toggles, off by default since neither TV decodes them). Transcodes go to HLS with video copy where possible, audio EAC3/AC3/AAC up to 5.1. Max bitrate 200 Mbps, so the server never transcodes "because of bitrate" in the LAN.
- **No playback reporting** in the test app: test runs must not change watched state or resume positions on the user's account. Transcode jobs are stopped on close (`DELETE /Videos/ActiveEncodings`).
- App id `nl.jellycast.webos`; icons resized from the Android app's `docs/images/design/icon.png`.

### The app chooses the audio track (2026-10-23)

Neither TV decodes TrueHD or DTS, and both play the first track they can decode, whatever its language. So the profile now says what the TVs really do (TrueHD off, DTS off) and `chooseAudioStream` (`src/playback/audioTrack.ts`, unit-tested) picks the track before PlaybackInfo:

1. A decodable **Atmos** track (EAC3 JOC) in the default track's language, also when the file marks another track as default (user's choice, 2026-10-23).
2. Otherwise the file's default track when the TV decodes it.
3. Otherwise a decodable track in the same language, not a commentary, with at least the default's channels (capped at 5.1); most channels first.
4. Otherwise the default track, and the server converts only the audio.

The choice goes to PlaybackInfo as `AudioStreamIndex`. For direct play the player then enables that track in `video.audioTracks` (which lists only decodable tracks, in file order) once the metadata is loaded. Switching works on both TVs: with the file-default rule The Gentlemen moved from track #0 to track #1 before the first frame. Confirmed by ear: In the Grey plays in English (user, 2026-10-23). With the Atmos rule The Gentlemen keeps track #0 (EAC3 Atmos), as do Spider-Man and the other Atmos-first files.

What it changes in the `claude` account's library (1363 items): the 92 items with DTS as default have no decodable track in the same language and stay an audio transcode; for 75 TrueHD items the TV already landed on the right AC3/EAC3 track; **In the Grey** (TrueHD and DTS in English, AC3 only in five other languages) played in Spanish and now gets English audio converted by the server. The gain is a reliable language, not more direct play.

**Vitest 5.0.5** added as a dev dependency for unit tests of pure playback logic (`npm test`).

### Request `main.m3u8`, never `master.m3u8` (2026-10-23)

For an HDR source the server's master playlist lists three variants with the same bandwidth: the copied HDR stream, an SDR HEVC and an SDR H.264 variant (both tone-mapped on the N150). The webOS player picks one itself, and on the CS it sometimes took the H.264 SDR one: no HDR mode, full 4K encode, stalls (user saw it on Oppenheimer; ffmpeg logs `FFmpeg.Transcode-…13-09-14` and `…13-14-47` show `h264_qsv` with `tonemap=1`). `planStream` now rewrites the transcoding URL to `main.m3u8`, the copied variant. After the fix: Oppenheimer 3/3 on the CS and 2/2 on the C2 with video copied (`FFmpeg.DirectStream` logs). Same lesson as the Android app (`../jellycast-ios/docs/server.md` → API lessons).

The `claude` account is a server administrator, so `/System/Logs` shows the ffmpeg command line of each job: the reliable way to see what the server does.

### Findings from the first run on the C2 (2026-10-23)

- **Always send `SubtitleStreamIndex=-1`** (PlaybackInfo body and the direct-play URL). Without it the server picked the account's default subtitle and burned it in, which turned four DV items into full 4K video transcodes. Same lesson as the Android app.
- **Refuse items without a video stream** before playing: the webOS player reloads the whole app on them.
- **Measure the first frame by `currentTime`**, not `requestVideoFrameCallback` or `getVideoPlaybackQuality` (both stay silent or zero on webOS).
- **`/Sessions` keeps the last `TranscodingInfo`** after a job ends (without playback reporting). Ask it only during a transcode.
- **webOS 24 hides tracks it cannot decode** from `video.audioTracks` (TrueHD, DTS) and plays the first track it can. Direct play of DV p5, p7 FEL, p8.1, p8.6, HDR10, HDR10+ and HLG all start; mkv and large mp4 both work.

### Checked from the Mac (2026-10-23)

- The server sends `Access-Control-Allow-Origin: *` and answers CORS preflights, so the app can call it from `file://` and from the Vite dev server.
- `POST /QuickConnect/Initiate` answers with a code for this client's headers.
- The Claude browser pane cannot reach `192.168.1.4` (`ERR_ADDRESS_UNREACHABLE`); test the sign-in in a normal browser or on the TV.

## Playback results

### c2, webOS 24, 2026-10-23 (run by Claude over the DevTools protocol)

DP = direct play, TC = transcode. "First frame" = from the start request until `currentTime` first advances (webOS draws video on a hardware plane, so `requestVideoFrameCallback` never fires). "Seek" = +60 s until `playing` again. The user did not watch this run; picture and sound are not judged yet.

| # | Item | Stream | Result | First frame | Seek | Remarks |
|---|---|---|---|---|---|---|
| new | Friday Night Lights 1x1 | mkv H.264 1080p, AC3 5.1 | DP | 1.0 s | 0.3 s | First try 9.9 s: HDD spin-up |
| new | Avatar: TLA 2x1 | mkv HEVC 4K HDR10, EAC3 Atmos | DP | 1.2 s | 1.6 s | |
| 12 | Dark Matter 1x1 | mkv HEVC HDR10+, EAC3 Atmos | DP | 1.2 s | 1.8 s | |
| 14 | Star City 1x4 | mkv DV p5 | DP | 1.2 s | 1.6 s | |
| 20 | The White Lotus 1x1 | mkv DV p8.1 | DP | 7.5 s | 5.1 s | Long `waiting` before the first frame: probably the DV mode switch |
| 26 | The White Lotus 3x4 | mkv HLG 25 fps | DP | 5.2 s | 4.9 s | Same pattern as DV p8.1: mode switch? |
| 24 | Game of Thrones 1x1 | mkv DV p8.6, TrueHD + 2× AC3 | DP | 2.4 s | stalled | `audioTracks` shows 2 tracks: TrueHD is hidden; the server chose AC3 as the default |
| 18 | Ready Player One | mkv DV p7 FEL, TrueHD default + 2 DTS + 12 AC3, 92 Mbps | DP (TrueHD on) | 3.0 s | 3.9 s | `audioTracks` shows only the 12 AC3 tracks; the TV plays the first AC3 track instead of TrueHD |
| 18 | Ready Player One | same, TrueHD off | TC (audio) | 11.1 s | stalled | Audio → AC3. Server reported video encoded (master playlist variant); with `main.m3u8` 12.3 s, video copied |
| 17 | Game of Thrones 8x6 | mkv DV p7 FEL, 116.8 Mbps | DP | 1.3 s | 5.1 s | `audioTracks` shows 14 of 17 tracks (only AC3) |
| new | Spider-Man: Brand New Day | mp4 32 GB, DV p8 + HDR10+, 8× EAC3 | DP | 3.7 s | 1.0 s | All 8 tracks visible |
| 42 | The Gentlemen 2x1 | mp4 DV p8.1, default track not first | DP | 2.2 s | 1.4 s | |
| 48 | Oppenheimer | mkv HDR10, DTS-HD MA only, 68.8 Mbps | TC (audio) | 26.3 s | 7.0 s | Video copied, audio → AC3 (QSV) |
| 53 | The Sopranos 3x9 | mkv H.264, DTS-HD MA default | TC (audio) | 7.5 s | 4.1 s | Video copied, audio → AC3; the FLAC track was not chosen |
| 29 | Blow | mkv VC-1 | TC (video) | 5.0 s | — | Video → HEVC (QSV), as expected |
| 59 | Friends 10x8 | no streams | refused | — | — | Before the guard, playing it reloaded the whole app |

Not in the `claude` account's libraries (404), so replaced or dropped: Alone 0x18, The Queen's Gambit 1x1, Jurassic World Rebirth, Sons of Anarchy 1x1 (no other DTS-core-only item visible), The Usual Suspects (no other ts item visible). The account sees 1363 items, the matrix counted 2073.

### Audio track choice, both TVs, 2026-10-23

| Item | Chosen | C2 | CS |
|---|---|---|---|
| Game of Thrones 1x1 | AC3 eng (TV track #0) | DP 0.9 s | — |
| Ready Player One | AC3 eng (TV track #0) | DP 3.2 s | DP 3.5 s |
| In the Grey | TrueHD eng, server converts | TC 5.2 s, video copied | TC 5.6 s, video copied |
| Game of Thrones 8x6 | AC3 eng (TV track #0) | DP 1.3 s | — |
| The Gentlemen 2x1 | EAC3 5.1 default (TV track #1) | DP 2.1 s, switched | DP 2.6 s, switched |
| The Gentlemen 2x1, Atmos rule | EAC3 Atmos (TV track #0) | DP 2.5 s | — |
| The Sopranos 3x9 | DTS eng, server converts | TC 4.2 s | — |

### Watched by the user (2026-10-23)

On both TVs during the automated runs: playback is smooth and has sound, and as far as checked the TV switches correctly between HDR and SDR. The picture stutters only right after a seek. DV p7 versus HDR10 and the language of the fallback track were not checked.

### cs, webOS 25, 2026-10-23 (run by Claude over the DevTools protocol)

Same procedure and items as on the C2, profile defaults (DTS off, TrueHD on, HLS mp4).

| # | Item | Result | First frame | Seek | Remarks |
|---|---|---|---|---|---|
| new | Friday Night Lights 1x1 | DP | 1.3 s | 0.8 s | |
| new | Avatar: TLA 2x1 | DP | 1.6 s | 2.1 s | |
| 12 | Dark Matter 1x1 | DP | 1.1 s | 2.4 s | |
| 14 | Star City 1x4 | DP | 1.5 s | 1.9 s | |
| 20 | The White Lotus 1x1 | DP | 2.7 s | 1.7 s | Much faster than on the C2 (7.5 s) |
| 26 | The White Lotus 3x4 | DP | 1.6 s | 1.2 s | Faster than on the C2 (5.2 s) |
| 24 | Game of Thrones 1x1 | DP | 1.1 s | 1.3 s | `audioTracks`: 2 (TrueHD hidden, as on the C2) |
| 18 | Ready Player One | DP | 3.7 s | 5.3 s | `audioTracks`: the 12 AC3 tracks only, as on the C2 |
| 17 | Game of Thrones 8x6 | DP | 1.5 s | 6.3 s | 116.8 Mbps; `audioTracks`: 14 AC3 tracks |
| new | Spider-Man: Brand New Day | DP | 4.6 s | 1.8 s | |
| 42 | The Gentlemen 2x1 | DP | 2.8 s | 3.4 s | |
| 48 | Oppenheimer | TC (audio) | 11.9 s | — | This run picked the H.264 SDR variant: no HDR (user). With `main.m3u8`: 13.4 s, video copied |
| 53 | The Sopranos 3x9 | TC (audio) | 4.0 s | — | Video copied, audio → AC3 |
| 29 | Blow | TC (video) | 4.5 s | — | Video → HEVC (QSV) |
| 59 | Friends 10x8 | refused | — | — | |

The webOS 25 TV behaves like the webOS 24 TV: the same direct-play coverage and the same hidden TrueHD/DTS tracks. HDR mode switches (DV p8.1, HLG) cost less time on the CS.
