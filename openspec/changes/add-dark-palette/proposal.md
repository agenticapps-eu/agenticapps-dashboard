# Add the dark token palette

## Why

The product tells every user it is dark by default, and then renders light. `lib/theme.ts`
defaults to `dark`, `applyTheme()` puts `.dark` on the document element, `/settings` offers a
three-way appearance control, and `design-system` states that the product SHALL default to a
dark appearance and offer a light alternative. None of it has any effect, because `tokens.css`
defines one palette and no `.dark` block — `global.css` says so out loud: *"Preserved for future
Phase 6 dark-mode tokens — does nothing without a `.dark{}` block."* The appearance control is a
radio group that changes nothing a user can see.

The second reason is timing. The `repo-readiness` indicator (`add-repo-readiness` §8) encodes
check state in colour and renders check values *inside* that colour, which promotes the status
tokens from decoration to body text. Its acceptance criteria require the contrast test green in
light **and** dark, and there is no dark to test. Authoring the palette now unblocks that work
and settles the floors before a surface depends on them.

Extending the contrast assertion to the tokens that were never covered also exposes a defect
already shipping: `--color-status-warning` (`#C2802B`) scores **3.03–3.27** against every
background, under the 4.5 body-text floor. It has gone unnoticed because the existing test
asserts three `text-*` tokens against two of the four backgrounds, and no status colour at all.

## What Changes

- `tokens.css` gains a `.dark` block redefining all sixteen colour tokens plus `--shadow-card`.
  Because every consumer resolves through `var(--color-*)`, no component changes.
- The light `--color-status-warning` is corrected from `#C2802B` to `#96601C`, the smallest
  change that clears the 4.5 floor on all four light backgrounds (min 4.88, same hue family).
- `verify-contrast.test.ts` grows from 3 tokens × 2 backgrounds × 1 palette to 7 tokens × 4
  backgrounds × 2 palettes, and locks the secondary/tertiary tier gap in both palettes.
- The appearance control on `/settings` starts doing what it says.

No behaviour outside colour changes. No component file is edited.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-system`: *Enforced Colour Contrast Floors* binds the floor to **every colour token
  that renders as text, against every background it renders on, in every palette the product
  ships**. Today the requirement's words are satisfiable by a single palette that leaves status
  colours and `card-bg` unasserted; this closes both gaps.

*Theme Support* is deliberately **not** modified. It already promises dark-by-default with a
light alternative. This change makes that promise true rather than changing what is promised.

## Impact

- `packages/spa/src/styles/tokens.css` — the `.dark` block and the one light correction.
- `packages/spa/src/styles/verify-contrast.test.ts` — parses both palettes, asserts the wider matrix.
- Every SPA surface renders in dark by default for the first time. Visual-only; no logic path changes.
- `tokenSourceOfTruth.test.ts` and `noOrange.test.ts` are unaffected: hex literals stay confined
  to `tokens.css`, and `#96601C` is a dark amber-brown, not one of the banned bright oranges.
- Known limitation, not fixed here: the 36 opacity-modified utilities (`bg-accent/10`,
  `border-status-error/40`, …) compile to a baked light hex as the pre-`@supports` fallback,
  with the `var()`-based `color-mix` form inside `@supports (color: color-mix(…))`. Every
  current browser takes the `@supports` path; a browser without `color-mix` would show light
  values in dark.
