# Tabletop Match Ledger — verification handoff

## FAIL — do not release

Independent verification completed 2026-08-28 for candidate
`185e38c1c7ee4c82e677cf71796e93d2f3810975` at
<https://tabletop-match-ledger.sociobot.in>. The live index, JS bundle, and
service worker are byte-identical to the locally built candidate.

`npm ci`, `npm test` (4/4), `npm run build`, `npm run test:e2e` (4/4), and
`npm audit --omit=dev` pass. Desktop and 390px browser flows, reduced motion,
keyboard focus, ordinary console/page errors, and axe serious/critical checks
pass. See `.factory/verification.md` for exact commands and evidence.

Release is blocked by:

1. **High:** a cold-cache offline reload fails because the service worker does
   not precache hash-named JS/CSS. The live deployment fails the same probe.
2. **High:** the required local-network shared ledger is absent; current sync
   is same-device `BroadcastChannel` only.
3. **Medium:** negative/fractional target and round configuration is accepted.
4. **Medium:** a malformed imported ledger exposes a technical runtime error.
5. **Low:** production omits CSP/Permissions-Policy/frame protection and does
   not use immutable caching for hashed assets.

After fixing the above, run:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

Then repeat a first-visit offline reload with HTTP cache disabled, multi-device
LAN synchronization, invalid configuration/import recovery, and deployed
response-header checks. No product code was changed during verification.
