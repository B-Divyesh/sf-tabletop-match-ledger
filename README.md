# Tabletop Match Ledger

Tabletop Match Ledger is a fast, offline-first score sheet for groups playing multi-round tabletop games. It keeps cumulative totals, explicit score-track laps and positions, targets, round limits, corrections, and an immutable activity trail on one shared device.

Live product: <https://tabletop-match-ledger.sociobot.in>

## Who it is for

It is built for tables that otherwise use paper, phone notes, or memory when a board wraps from 99 back to 0 or a match continues across several hands. It is deliberately rules-neutral: the group chooses its own track, target, rounds, and score deltas.

## Features

- Two-to-six player setup designed to take seconds
- Cumulative totals with derived completed laps and current board position
- Optional target score and round limit
- Append-only rounds, named corrections, and undo events
- Final text receipt via Web Share or clipboard
- JSON backup/import and CSV activity export
- IndexedDB persistence and installable offline PWA shell
- Same-device cross-tab updates via `BroadcastChannel`
- Keyboard, screen-reader, 390px mobile, and reduced-motion support
- Optional $5 Table Keeper license for two extra themes; all functional features remain free

## Develop and verify

Requires Node.js 20 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
```

The exact production build command is `npm run build`. Static output lands in `dist/`, with `dist/index.html` at its root. `npm run test:e2e` uses Playwright 1.58.2 and expects its Chromium browser to be installed.

## Deployment

Deploy the contents of `dist/` as a static site with clean-directory routing for `/privacy/` and `/terms/`. Do not deploy repository source files. The service worker uses versioned caches; increment its `VERSION` when changing its caching behavior.

The checkout and verification integration uses the Sociobot API. The factory registers the product separately; this repository contains no provider secret or product ID.

## Data and privacy

Match data stays in browser IndexedDB. Theme and optional license state use local storage. There are no analytics, advertising trackers, third-party scripts, or CDN fonts. Users own their data through JSON/CSV export. See [privacy/index.html](privacy/index.html) and [terms/index.html](terms/index.html).

## Visual assets

The original score-orbit illustration was generated for this product using the factory Azure image model and optimized locally. Its prompt and provenance are recorded in [.factory/design.md](.factory/design.md) and `assets/src/`. App icons are original hand-authored SVG geometry.

## License

MIT. See [LICENSE](LICENSE).
