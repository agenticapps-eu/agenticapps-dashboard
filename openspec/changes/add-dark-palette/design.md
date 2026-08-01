# Design — add the dark token palette

## Context

`tokens.css` holds one palette, published inside Tailwind 4's `@theme` block. Tailwind
compiles each token utility to a custom-property reference — verified against the built
bundle:

```css
.text-text-primary { color: var(--color-text-primary) }
.bg-card-bg        { background-color: var(--color-card-bg) }
```

Roughly 1,100 utility usages across the SPA resolve this way, and `tokenSourceOfTruth.test.ts`
guarantees no component contains a hex literal, so **every** colour in the product passes
through these sixteen custom properties. Redefining them under a `.dark` selector therefore
repaints the whole application without touching a component.

The runtime half is already built and dormant: `applyTheme()` toggles `.dark` on
`document.documentElement`, `initTheme()` runs before `createRoot()` to avoid a first-paint
flash, `readChoice()` defaults to `dark` (D-02), and `global.css` already declares
`@custom-variant dark (&:where(.dark, .dark *))`.

`verify-contrast.test.ts` parses `tokens.css` with a regex and asserts three `text-*` tokens
against `app-bg` and `sidebar-bg`. It does not cover `card-bg`, `card-bg-hover`, the accent,
or any status colour.

## Goals / Non-Goals

**Goals:**

- A dark appearance that is genuinely default, matching what `design-system` already promises.
- Contrast floors asserted across every text-bearing token, every background, both appearances.
- Zero component edits — the palette is the entire change surface.
- The seam that catches a half-defined appearance, so the next token added cannot silently
  inherit a value designed for the opposite ground.

**Non-Goals:**

- Per-appearance component styling. If a surface needs different *structure* in dark, that is a
  separate change; this one changes values only.
- Fixing the `color-mix` fallback for opacity-modified utilities (see Risks).
- Re-tuning the light palette beyond the one token that fails its floor.
- A third appearance, or high-contrast/forced-colors support.

## Decisions

### D-1 · Override custom properties under `.dark`, not `dark:` variants

**Chosen:** a plain `.dark { --color-*: … }` block after `@theme`.

**Alternative rejected — `dark:` utility variants on components.** It would mean editing every
one of ~1,100 usages, doubling the class strings, and giving each component its own opportunity
to disagree with the palette. It also defeats `tokenSourceOfTruth.test.ts`'s premise that colour
decisions live in one file.

**Alternative rejected — a second `@theme` block.** Tailwind 4 treats `@theme` as the utility
generator; two blocks generate conflicting utilities rather than one set reading two variable
scopes. The variable-override form is the documented Tailwind 4 pattern for exactly this.

### D-2 · Palette A, "warm ink"

Surfaces carry a faint purple cast (`#1A1721` app, `#221E2B` card) rather than a neutral slate.
The light palette's identity is "warm paper"; inverting it preserves that identity instead of
swapping it for a hueless one, and lets the purple accent sit inside the palette rather than on
top of it.

**Alternative rejected — neutral slate (`#17171A` / `#1F1F23`).** Measured marginally higher
contrast (by 0.02–0.27, inside the headroom and invisible in use) and makes data read slightly
louder, at the cost of the product's warm signature in its default appearance. Both candidates
were rendered on a mock of the real fleet surface and compared before choosing.

### D-3 · `--color-status-warning` `#C2802B` → `#96601C` in the light palette

The shipping value scores 3.03–3.27 against all four light backgrounds, under the 4.5 body-text
floor. `#96601C` is the smallest correction that clears it (min 4.88), at hue 33° against the
original's 34° — the same designed colour, darker. Its headroom is consistent with how the rest
of the light palette is tuned (`text-tertiary` ships at 4.71).

**Alternative rejected — hold status colours to WCAG's 3:1 non-text floor**, which the current
value passes. The readiness indicator renders coverage percentages and version strings *in* the
status colour, which makes it body text; 3:1 would be the wrong floor for how the colour is
actually used, chosen because it happens to pass.

**Alternative rejected — leave it and file a follow-up.** It would mean knowingly shipping a
WCAG failure in the appearance a user selects deliberately, in the same change that adds a
contrast test broad enough to see it.

### D-4 · The contrast test parses both blocks from one file

`tokens.css` stays the single source of truth. The test extracts the `@theme` body and the
`.dark` body separately and runs the same matrix over each: 7 text-bearing tokens × 4
backgrounds × 2 appearances. Keeping it a node-environment file-parsing test (as it is today)
rather than a DOM test matters — jsdom does not run Tailwind, so computed-style assertions
would test nothing.

### D-5 · Completeness is asserted, not assumed

A separate assertion compares the token key sets of the two blocks. Without it, a token added
to `@theme` and forgotten in `.dark` inherits the light value on a dark ground and nobody finds
out until someone looks. This is the cheapest possible guard for the most likely future defect.

### D-6 · The tier gap is locked per appearance, at each appearance's own value

Light ships a secondary/tertiary ratio of ~1.11; the dark palette lands at ~1.28. The test locks
each against a floor rather than forcing them equal — the perceptual requirement is that the
tiers stay distinct, and dark has more room to be distinct in.

## Risks / Trade-offs

- **Opacity-modified utilities bake a light hex into their non-`@supports` fallback.** Tailwind
  emits `.bg-accent\/10{background-color:#6b46c11a}` followed by an
  `@supports (color: color-mix(…))` block using `var(--color-accent)`. 36 such usages exist. In
  every browser that supports `color-mix` — Chrome 111+, Safari 16.2+, Firefox 113+ — the
  `@supports` rule wins and dark renders correctly. → **Mitigation:** accepted and recorded
  rather than fixed; hand-writing 36 overrides would reintroduce per-component colour decisions,
  which is the thing D-1 exists to prevent.

- **Every surface changes appearance at once, and no surface has been reviewed in dark.** →
  **Mitigation:** `impeccable:critique` at 1440×900 against a representative route in dark,
  composite ≥ 80, artifact committed, per the CLAUDE.md process gate.

- **`--shadow-card` is `rgba(0,0,0,0.04)`** — invisible on a dark ground, so cards would lose
  their separation from the page. → **Mitigation:** the dark block gives it its own value;
  elevation on dark comes from the surface step (`app-bg` → `card-bg`) with the shadow as
  reinforcement rather than the primary cue.

- **The light appearance changes too**, via D-3. Anyone who has chosen light sees the warning
  colour darken. → **Mitigation:** it is a one-shade correction within the same hue, and the
  alternative is leaving a failing token in place.

## Open Questions

- None blocking. Whether any surface needs *structural* rather than value-level adjustment in
  dark is deliberately deferred to whatever the critique finds.
