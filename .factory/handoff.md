# Tabletop Match Ledger — build handoff

Build completed: 2026-08-28

Work order: `tabletop-match-ledger-build-1`

Artifact: static offline PWA, output in `dist/`

## What was built

- Five-second setup for 2–6 players, match name, wraparound track length, optional target, and optional round limit.
- Round entry with touch-friendly increment/decrement controls, arbitrary whole-number input, negative scores, and round notes.
- Derived cumulative totals, explicit completed laps, current board position, target progress, and ranked standings.
- Append-only score events, named correction events, and undo events. Prior history remains visible and explainable after an undo.
- Automatic finish at a target, round-limit completion, manual finish, undo from the finished state, and a share/copy final receipt.
- User-owned JSON backup/import and CSV event export.
- IndexedDB local persistence; `BroadcastChannel` updates between open tabs on the same device.
- Installable PWA manifest, 192/512/maskable icons, versioned service-worker caches, network-first navigation, cache-first same-origin assets, offline fallback, update feedback, and explicit offline UI state.
- Optional $5 Table Keeper license flow using only the Sociobot checkout/verify endpoints. It unlocks two visual themes; all scoring, history, accessibility, offline, and export features remain free. License capture, daily cached verification, optimistic offline unlock, inactive notice, and paste-to-restore are implemented.
- Product-specific score-orbit visual system, original generated hero, responsive 390px/wide layouts, reduced-motion behavior, designed focus states, privacy page, and terms page.

## Verification

From a clean checkout:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

Results on the handoff build:

- `npm test`: 4/4 model tests pass.
- `npm run build`: passes; `dist/index.html` exists at the deploy root.
- `npm run test:e2e`: 4/4 Playwright 1.58.2 mobile Chromium tests pass.
- Browser flows cover setup, a 237-point score on a 100-space track (2 laps + position 37), reload persistence, undo/history, one-`h1` semantics, offline reload, and console/page errors.
- Axe in Playwright: 0 serious or critical violations on setup and live-match views; full Lighthouse accessibility score is 100.
- Offline: production build opened once, Chromium context switched offline, reload succeeded with stored shell and offline state.
- Console: no console errors during load, setup, and round commit.
- `npm audit --omit=dev`: 0 vulnerabilities.

Lighthouse 12.8.2 mobile emulation against the production preview:

| Category / metric | Result |
| --- | ---: |
| Performance | 100 |
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 100 |
| FCP | 0.9 s |
| LCP | 1.5 s |
| CLS | 0 |
| Total transfer | 44 KiB |

The production bundle is 27.69 KB JS / 17.66 KB CSS uncompressed (9.51 KB / 4.83 KB gzip). The responsive hero is 19 KB AVIF and 27 KB WebP. Lighthouse did not emit an INP value for its navigation-only synthetic run; direct score interactions are covered by Playwright.

## Product and deployment notes

- Exact build command: `npm run build`.
- Deploy directory: `dist/`.
- The factory still needs to register `tabletop-match-ledger` with the Sociobot billing engine and verify the hosted checkout/return URL in its environment. No product ID or secret is embedded here.
- Increment `VERSION` in `public/sw.js` when changing cache behavior or precached public assets.
- Match data stays local. The only network request beyond static assets is a license verification when a user has supplied a license.

## Known gaps / next steps

- v1 is a pass-around shared-device ledger. It synchronizes multiple tabs on that device, but it does not attempt peer-to-peer live synchronization between separate phones on a LAN. JSON/share handoff is the reliable cross-device path; adding WebRTC would require a trustworthy signaling and conflict-design pass.
- The live paid checkout could not be exercised before factory product registration. Free behavior and cached/offline license behavior do not depend on that service.
- Browsers may evict IndexedDB under storage pressure. The interface therefore keeps JSON/CSV export available for important matches.
