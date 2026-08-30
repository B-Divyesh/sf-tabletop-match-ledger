# Tabletop Match Ledger

Tabletop Match Ledger is an offline-first score sheet for groups playing multi-round tabletop games. It keeps cumulative totals, explicit laps and positions, targets, round limits, corrections, and an append-only activity trail. Pair two devices directly on the same local network when a table needs a shared view.

Live product: <https://tabletop-match-ledger.sociobot.in>

Try the isolated sample match: <https://tabletop-match-ledger.sociobot.in/?demo=1>

## Who it is for

It is built for tables that otherwise use paper, phone notes, or memory when a board wraps from 99 back to 0 or a match continues across several hands. It is deliberately rules-neutral: the group chooses its own track, target, rounds, and score deltas.

## Features

- Two-to-six player setup
- Cumulative totals with derived completed laps and current board position
- Optional target score and round limit
- Append-only rounds, named corrections, and undo events
- Final text receipt via Web Share or clipboard
- JSON backup/import and CSV activity export
- IndexedDB persistence and installable offline PWA shell
- Manual, serverless WebRTC pairing for direct local-network device sync, plus same-device `BroadcastChannel` updates
- Keyboard, screen-reader, 390px mobile, and reduced-motion support
- Optional $5 Table Keeper license for two extra themes; all functional features remain free

The sample match uses its own `demo:current-match` IndexedDB key. Resetting or
leaving the demo never changes the real `current-match` ledger.

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

Deploy the contents of `dist/` as a static site with clean-directory routing for `/privacy/` and `/terms/`. Do not deploy repository source files. The build generates a versioned `sw.js` with every emitted JS/CSS asset in its precache; do not replace it with a hand-written worker. Apply the included `dist/_headers` response policy on the static host (CSP, frame protection, manifest MIME type, and immutable hashed assets).

The checkout and verification integration uses the Sociobot API. The factory registers the product separately; this repository contains no provider secret or product ID.

## Data and privacy

Match data stays in browser IndexedDB. Theme and optional license state use local storage. There are no analytics, advertising trackers, third-party scripts, or CDN fonts. Users own their data through JSON/CSV export. See [privacy/index.html](privacy/index.html) and [terms/index.html](terms/index.html).

## Visual assets

The original score-orbit illustration was generated for this product using the factory Azure image model and optimized locally. Its prompt and provenance are recorded in [.factory/design.md](.factory/design.md) and `assets/src/`. App icons are original hand-authored SVG geometry.

## License

MIT. See [LICENSE](LICENSE).
