# Demo sandbox

Open `/?demo=1` locally or
<https://tabletop-match-ledger.sociobot.in/?demo=1> in production.

The demo opens a seeded three-player match named “Sunday strategy table”. It
contains two rounds and one explained correction on a 100-space track. The
persistent demo banner offers **Reset demo** and **Start for real**.

Demo state uses the IndexedDB key `demo:current-match`. Real state uses
`current-match`. Demo mode also uses a separate `BroadcastChannel` namespace
and hides device pairing, so sample changes cannot reach a real ledger. Leaving
demo mode deletes the demo key and restores the real ledger.
