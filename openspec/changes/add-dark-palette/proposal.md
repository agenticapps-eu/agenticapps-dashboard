# Add the dark token palette

## Why

The product tells every user it is dark by default, and then renders light. `lib/theme.ts`
defaults to `dark`, `applyTheme()` puts `.dark` on the document element, `/settings` offers a
three-way appearance control, and `design-system` states that the product SHALL default to a
dark appearance and offer a light alternative. None of it has any effect, because `tokens.css`
defines one palette and no `.dark` block — `global.css` says so out loud: *"Preserved for future
Phase 6 dark-mode tokens — does nothing without a `.dark{} `block."* The appearance control is a
radio group that changes nothing a user can see.

The second reason is timing. The `repo-readiness` indicator (`add-repo-readiness` §8) encodes
check state in colour and renders check values *inside* that colour, which promotes the status
tokens from decoration to body text. Its acceptance criteria require the contrast test green in
light **and** dark, and there is no dark to test.

The existing contrast test asserts three `text-*` tokens against two of the four background
tokens, and no status colour, no tinted surface, and no fill. Widening it to the pairings that
actually occur in the SPA exposes failures already shipping in light, and would have exposed
several more in the dark palette had they not been caught in review.

## What Changes

- `tokens.css` gains a `.dark` block defining all nineteen colour tokens plus `--shadow-card`
  and `color-scheme`.
- **Three tokens are added** so that fill and foreground stop sharing one value:
  `--color-accent-bg-strong-hover`, `--color-status-error-strong`,
  `--color-status-error-strong-hover`. A colour that must read *as text on a page* and a colour
  that must sit *behind white text* pull in opposite directions; light satisfies both by
  coincidence, dark cannot.
- **Four shipping light values are corrected** to clear floors they fail today:
  `status-warning` `#C2802B → #8F5D18`, `status-success` `#2E7D5B → #2A7354`.
- **Eighteen component call sites change class**, all mechanical: twelve `bg-accent text-white`
  fills move to `bg-accent-bg-strong`, two destructive buttons move to
  `bg-status-error-strong`, two `hover:bg-red-700` (a Tailwind default red that never followed
  the palette) are replaced, one `CoverageCell` chip moves off a self-tint onto a neutral
  surface, and `HelpLayout` regains `dark:prose-invert`.
- `verify-contrast.test.ts` grows from 6 assertions to **148** — every pairing that occurs in
  the SPA, in both appearances — plus a token-set completeness assertion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-system`: *Enforced Colour Contrast Floors* binds the floor to **every colour token
  that renders as text, against every background it renders on — including tinted and filled
  surfaces — in every appearance the product ships**. Today the requirement's words are
  satisfiable by a single palette that leaves status colours, tinted surfaces, fills and
  `card-bg` unasserted.

*Theme Support* is deliberately **not** modified. It already promises dark-by-default with a
light alternative. This change makes that promise true rather than changing what is promised.

## Impact

- `packages/spa/src/styles/tokens.css` — the `.dark` block, three new tokens, two light corrections.
- `packages/spa/src/styles/verify-contrast.test.ts` — both appearances, the real pairing matrix.
- Eighteen component call sites, class changes only; no logic, no props, no structure.
- `HelpLayout.tsx` — restores `dark:prose-invert`, removed in Phase 7 precisely because the
  `.dark` class fired app-wide with no dark tokens behind it. Adding the tokens inverts that
  bug, so the modifier has to come back in the same change.
- Every SPA surface renders dark by default for the first time.
- `tokenSourceOfTruth.test.ts` and `noOrange.test.ts` stay green: hex literals remain confined
  to `tokens.css`, and no corrected value is a banned orange.
- Known limitation, not fixed: the 36 opacity-modified utilities compile a baked light hex as
  their pre-`@supports` fallback, with the `var()`-based `color-mix` form inside
  `@supports (color: color-mix(…))`. Every current browser takes the `@supports` path.
