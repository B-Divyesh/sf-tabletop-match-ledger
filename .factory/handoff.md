# Tabletop Match Ledger — repair handoff

## Status

PASS for work order `tabletop-match-ledger-repair-2` on 2026-08-30. The
production runtime from source commit `fad0634` is deployed at
<https://tabletop-match-ledger.sociobot.in>.

Only the existing Azure Static Web App `sf-tabletop-match-ledger` was read and
updated. No DNS, database, key vault, shared service, or sibling resource was
read or changed.

## Repairs

- The Vite build now generates a content-versioned service worker after all
  output exists. It precaches the emitted hashed JS/CSS and excludes Azure host
  control files that are consumed rather than served.
- Manual WebRTC offer/answer pairing now shares the ledger directly between
  table devices. It uses no signaling or relay server, waits for ICE gathering,
  validates peer data, and merges the append-only event histories.
- Setup rejects non-integer or out-of-range track, target, and round values with
  announced recovery text.
- Import validates every match, player, and event field before changing memory
  or IndexedDB. Invalid files leave the current match intact.
- Azure Static Web Apps configuration now sends CSP, Permissions-Policy, frame
  protection, immutable caching for hashed bundles, and the registered PWA
  manifest MIME type. A styled 404 response is configured.
- Added an isolated `?demo=1` sample ledger with separate IndexedDB and
  BroadcastChannel namespaces, reset/exit controls, and claim-backed exports.
- Added `.factory/claims.json`, demo documentation, copy audit, social metadata,
  and exact browser regressions for every published product claim.

## Reproduction evidence

Candidate `185e38c` was rebuilt in a clean temporary checkout before repair.
With HTTP cache disabled, its service-worker cache contained no hashed bundles;
an offline fresh page failed `main-BviccKJn.css` and `main-Ab2EtErV.js` with
`net::ERR_FAILED` and rendered no heading. The candidate also accepted
`first to -5 · 1.5 rounds`, imported an event with no `scores` object, then
announced `Cannot read properties of undefined (reading 'a')`. Its live headers
had 30-second bundle caching, octet-stream manifest MIME, and no CSP,
Permissions-Policy, or frame protection.

## Verification evidence

Final clean run:

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
npm run test:e2e
```

- Clean install: 61 packages; zero audit vulnerabilities.
- Vitest: 7/7 passed, including schema, setup-range, merge, and response-policy
  regressions.
- TypeScript lint/typecheck: passed.
- Playwright 1.58.2: 26/26 passed across desktop Chromium and a 390×844 mobile
  viewport. Coverage includes keyboard focus, native-dialog focus, reduced
  motion, axe, demo isolation, privacy requests, export/import, receipt,
  licensing fixture, LAN sync, and the cold-page offline regression.
- Build: `dist/index.html` present. Initial JS is 39.08 KB / 12.59 KB gzip;
  CSS is 18.65 KB / 5.03 KB gzip.
- Live Lighthouse mobile: Performance 100, Accessibility 100, Best Practices
  100, SEO 100; LCP 1.1 s, CLS 0, TBT 0 ms.
- Live axe scans on `/`, `/?demo=1`, `/privacy/`, `/terms/`, and the 404 page:
  zero serious/critical violations. Valid routes had no console or page errors.
- Update simulation installed a second worker version and announced:
  `An update is ready. Reload to use it.`
- Live cold-offline probe: cached `main-B-bW_kWo.css` and
  `main-DpkUwRF7.js`; a new offline page rendered `Track every tabletop round.`
  with zero failed bundle requests.
- Live LAN probe: 864-character offer and answer codes connected two isolated
  browser contexts; Ada's committed total `12` appeared on the second device.
  No external HTTP request occurred during pairing or scoring.
- Live invalid-input probe returned the two intended range messages. A missing
  event `scores` object returned `The imported event scores are invalid.` and
  preserved the active match.
- Live response policy: hashed JS is
  `public, max-age=31536000, immutable`; the manifest is
  `application/manifest+json`; CSP, Permissions-Policy, and `X-Frame-Options:
  DENY` are present. An unknown route returns the styled page with HTTP 404.
- Local/live SHA-256 identity matched:
  - `index.html`: `b4fa0afe1ebedc3cdcb5690f684c25a0df8c311e2d381676f5aa0a109a172089`
  - `main-DpkUwRF7.js`: `d62fa2d8bdda0386ae9eb2c687e5c6dd50f8c1610592c9eb460417744ec9b1b5`
  - `sw.js`: `23f184a49b7f50b320524ee7bfb8c087638f307741b3b84109b446d25abe2069`

## Known limits and next steps

- LAN pairing is intentionally manual and local-only. Both browser pages must
  remain open; there is no cloud relay or background sync.
- Lighthouse does not report lab INP without a user interaction. The Playwright
  scoring, pairing, keyboard, and mobile flows exercise interactive behavior.
- No AI feature was added because scoring and local synchronization do not need
  model inference. The existing optional purchase remains limited to themes.
