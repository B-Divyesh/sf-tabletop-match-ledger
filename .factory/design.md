# Visual thesis — The score orbit

## Direction and rationale

**Generative geometry** turns the awkward arithmetic of a wraparound score track into the product's visual language. Concentric orbital lanes, plotted pips, and precise radial cuts echo a pawn repeatedly crossing a board's finish mark. Geometry explains the central model—position plus completed laps—rather than decorating a generic dashboard. The live ledger remains calm and tactile, like a well-made score sheet placed on dark felt.

## Palette

The single-mode palette is explicitly dark so a shared phone does not glare across a table:

- `ink` `#F7F1DF` — warm bone, primary text
- `felt` `#102D2A` — deep green-black background
- `felt-raised` `#173B36` — independent surfaces
- `line` `#55706A` — rules and inactive tracks
- `lime` `#D8F277` — primary action/current position; `#102D2A` contrast text
- `coral` `#FF8A70` — corrections and danger
- `sky` `#89D7F1` — information and secondary highlight
- `gold` `#F4C95D` — leader/target state
- `muted` `#B7C8C1` — secondary text

Text contrast is at least 4.5:1 on its intended background. State always has a label or icon in addition to color.

## Type and spacing

Two system stacks avoid a font payload and work offline. Headings use a compact geometric stack (`Avenir Next`, `Century Gothic`, `Trebuchet MS`, sans-serif); UI and long copy use the humanist system stack (`Inter`, `Segoe UI`, sans-serif). Scores use tabular numerals. Type steps are 0.78, 0.9, 1, 1.25, 1.75 and fluid display 2.25–4rem. Spacing follows a 4px base with 8, 12, 16, 24, 32, 48 and 64px intervals.

## Interaction grammar

The primary action is a lime lozenge. Secondary actions are outlined; destructive actions use coral text and always confirm or remain undoable. Score inputs are grouped as generous row-wide controls because a player should be able to pass the phone and enter a round in one thumb reach. The orbit motif tightens as a match progresses. Borders use deliberately clipped corners and offset geometric shadows, referencing a physical scoring tile without imitating paper.

On phones, setup and scoring become one column; persistent summary controls stay in document flow so browser UI and safe areas never hide them. On wide screens, the scoreboard and entry sheet share a two-column table. The marketing explanation and illustration disappear once a live match is in progress: the game state gets full deference.

## Motion

State changes use 180–240ms opacity and transform transitions. A newly committed score rises from its input row; the orbit marker advances along its track. No animation loops. Under `prefers-reduced-motion`, transforms and smooth scrolling are removed and updates become immediate opacity changes.

## Asset plan and provenance

The hero is an original raster illustration of an abstract tabletop score orbit, used only in the empty/setup state and social preview. It is paired with hand-authored SVG app icons derived from the same rings. No copyrighted game pieces, boards, marks, or rules appear.

Prompt sheet: “Top-down editorial still life of an invented abstract tabletop scoring instrument: concentric circular tracks cut from dark green felt and warm bone paper, tiny coral, sky-blue, golden and acid-lime geometric pawns, repeated lap arcs and precise score pips, tactile screen-print grain, long soft evening shadows, sophisticated generative geometry, asymmetrical crop with calm negative space, no people, no text, no letters, no numbers, no logos, no watermark, no recognizable commercial game components.”

Generated with the factory Azure image model (`factory-image`) on 2026-08-28. The selected source and prompt sidecar live in `assets/src/`; optimized WebP/AVIF derivatives live in `public/assets/`. Generated imagery is original to this product under the repository MIT license.
