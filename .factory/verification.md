# Verification report — FAIL

Verified 2026-08-28 against source commit
`185e38c1c7ee4c82e677cf71796e93d2f3810975` and the deployed URL
<https://tabletop-match-ledger.sociobot.in>.

## Result

**FAIL.** The deployment is the requested candidate, but it does not meet the
offline PWA acceptance contract and it does not provide the brief's required
local-network shared state. The other defects below also need resolution
before a release can pass.

## Reproducible evidence

Clean-checkout quality gates:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

All completed successfully: Vitest 4/4, Playwright 4/4, TypeScript plus exact
production Vite build, and zero production dependency vulnerabilities. Build
output was `27.69 KB` JS (`9.51 KB` gzip) and `17.66 KB` CSS (`4.83 KB`
gzip), inside the stated static budgets. There is no separate lint script;
`npm run build` runs `tsc --noEmit`.

The live deployment matches the candidate exactly:

| File | SHA-256 (live and locally built) |
| --- | --- |
| `index.html` | `9f10d5aa02e861860251e68df313d74a66515c69a66d490fe635230e511980d0` |
| `assets/main-Ab2EtErV.js` | `bb45d9f024d34bf2cc26e62c1039b2d8af3ea94bdc197bf35ae36697e2a6d96c` |
| `sw.js` | `db7e0cb6d6432661a0a2747ed62a1306eb414cf1fe070e80a99b7844420984bd` |

Browser checks used Chromium/Playwright 1.58.2. Normal scoring, explicit laps,
undo, append-only history, correction recovery, target receipt, reload
persistence, JSON export, 390px layout, keyboard skip link/focus, and reduced
motion were exercised. A 2-space track with `+99999` and `-99999` correctly
showed 49,999 laps/position 1 and -50,000 laps/position 1. At 390px, zero and
fractional round scores were rejected and a valid score then committed. Axe
had zero serious/critical findings on setup and active match views; no browser
console or page errors occurred in ordinary flows. The skip link was the first
Tab stop and had a `3px` visible focus outline. The live PWA manifest was
accepted by Chromium; a simulated service-worker version update produced the
in-app update toast.

Privacy review found no analytics, CDN fonts, or third-party requests during a
fresh ordinary session. Static inspection found only the optional,
user-initiated Sociobot checkout/license-verification endpoint. Match data is
stored in IndexedDB and exports are available. `/privacy/`, `/terms/`, README,
and MIT LICENSE are present.

Lighthouse could not complete in this container: both Lighthouse 13.4.1 and
12.8.2 closed their Chrome DevTools connection during cleanup even when pointed
at the Playwright Chromium binary. This is a tooling failure, not treated as a
passing score; bundle-size and browser accessibility/performance-smoke evidence
above were collected independently.

## Defects

### High — cold offline reload is broken

The service worker's `PRECACHE` omits the hash-named application JS and CSS.
After a fresh online visit, with normal HTTP cache disabled to test the service
worker rather than a browser cache, switching the context offline and reloading
the live site fails both:

```text
https://tabletop-match-ledger.sociobot.in/assets/main-BviccKJn.css  net::ERR_FAILED
https://tabletop-match-ledger.sociobot.in/assets/main-Ab2EtErV.js   net::ERR_FAILED
```

No app heading or offline state rendered. The checked-in Playwright offline
test passes because it benefits from prior browser caching; it does not prove
the installed shell is fully precached. This fails the core offline PWA and
"keep working at a kitchen table" requirements.

### High — no local-network shared ledger

The researched acceptance contract calls for a local-network/offline PWA and a
shared reliable match state. The implementation has no LAN/peer transport or
sync protocol: it uses `BroadcastChannel`, which synchronizes same-origin tabs
on the *same device* only. The existing handoff expressly confirms it is a
pass-around single-device ledger. JSON export/import is useful handoff, but is
not a shared local-network match state and cannot keep separate table devices
in sync.

### Medium — invalid target and round configuration is accepted

The setup form is `novalidate` and only validates track length in application
code. A browser exercise entered target `-5` and rounds `1.5`; it started a
match displaying:

```text
100-space track · first to -5 · 1.5 rounds
```

These violate the UI's own stated minimum/integer constraints and can make a
target match finish nonsensically. Reject non-integers and enforce the defined
ranges in application validation with an announced recovery message.

### Medium — malformed imported ledger produces a technical error

Importing JSON that passes the shallow shape check but includes a malformed
event leaves the setup screen and announces the implementation detail:

```text
Cannot read properties of undefined (reading 'a')
```

The importer should validate every player and event field before rendering or
saving, then provide a user-facing invalid-file explanation without partially
mutating in-memory state.

### Low — deployment response policy/caching is incomplete

The live site has HSTS, `nosniff`, and a strict referrer policy, but no Content
Security-Policy, Permissions-Policy, or frame-ancestors/X-Frame-Options was
returned. Hash-named JS/CSS are also served with only
`Cache-Control: public, must-revalidate, max-age=30`, not long-lived immutable
caching as required for static PWA assets. The manifest is served as
`application/octet-stream` (Chromium accepted it; serving a manifest MIME type
is still preferable).

## Required next verification

Precache the built hash-named JS/CSS (or generate the worker with the build),
then rerun a cold-cache offline reload. Implement an actual LAN sharing/sync
mechanism or formally change the approved scope. Add semantic validation for
setup and imported event payloads, then rerun the clean-checkout commands and
the desktop/mobile/PWA checks above.
