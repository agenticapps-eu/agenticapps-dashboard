# Design — add the dark token palette

## Context

`tokens.css` holds one palette inside Tailwind 4's `@theme` block. Tailwind compiles each token
utility to a custom-property reference — verified against the built bundle:

```css
.text-text-primary { color: var(--color-text-primary) }
.bg-card-bg        { background-color: var(--color-card-bg) }
```

So redefining those properties under a `.dark` selector repaints almost everything. The runtime
half is already built and dormant: `applyTheme()` toggles `.dark` on `document.documentElement`,
`initTheme()` runs before `createRoot()`, `readChoice()` defaults to `dark` (D-02), and
`global.css` declares `@custom-variant dark`.

"Almost" is the operative word, and it is what the pre-code review corrected. Three classes of
colour do **not** follow the tokens: Tailwind's built-in palette (`text-white`,
`hover:bg-red-700`), the typography plugin's `prose-slate`, and any token used simultaneously as
a foreground and as a fill. The first draft of this design claimed zero component edits; that
claim was false and is retracted here.

## Goals / Non-Goals

**Goals:**

- A dark appearance that is genuinely default, matching what `design-system` already promises.
- Contrast floors asserted over the pairings that **actually occur** in the SPA — plain
  surfaces, tinted surfaces, and fills — in both appearances.
- Fill and foreground roles separated, so no token is asked to be legible in two opposite ways.
- The seam that catches a half-defined appearance.

**Non-Goals:**

- Structural or layout differences between appearances. Values only.
- Fixing the `color-mix` fallback for opacity-modified utilities (see Risks).
- Dark-mode styling for the help docs beyond restoring `dark:prose-invert`.
- A third appearance, or high-contrast/forced-colors support.

## Decisions

### D-1 · Override custom properties under `.dark`, not `dark:` variants

**Chosen:** a plain `.dark { --color-*: … }` block after `@theme`.

**Alternative rejected — `dark:` utility variants on components.** ~1,100 usages would each need
a second class, and each becomes an opportunity to disagree with the palette.

**Alternative rejected — a second `@theme` block.** Tailwind 4 treats `@theme` as the utility
generator; two blocks generate conflicting utilities rather than one set reading two scopes.

### D-2 · Palette A, "warm ink"

Surfaces carry a faint purple cast (`#1A1721` app, `#221E2B` card) rather than a neutral slate,
inverting the warm-paper identity instead of replacing it.

**Alternative rejected — neutral slate (`#17171A` / `#1F1F23`).** Marginally higher contrast
(0.02–0.27, inside the headroom), at the cost of the product's signature in its default
appearance. Both were rendered on a mock of the real fleet surface before choosing.

### D-3 · Fill and foreground are different tokens

The defect the review caught: in palette A, `text-white` scores **2.10–2.99** on `bg-accent`,
`bg-accent-hover`, `bg-accent-bg-strong` and `bg-status-error` — fourteen call sites covering
every primary button, both destructive buttons, the sidebar active state and the skip link.

A colour that reads as text on a dark ground must be light. A colour that sits behind white text
must be dark. `--color-accent` was doing both. In light this is invisible because the ground is
light and the fill is dark — one value satisfies both roles by coincidence.

**Chosen:** the foreground keeps `--color-accent` (36 `text-accent`, 95 `ring-accent`,
8 `border-accent` usages — the dominant role). The fill role moves to `--color-accent-bg-strong`,
which already exists and already means exactly this (`SidebarItem.tsx:5`: *"active state =
bg-accent-bg-strong + text-white (filled purple pill)"*). Twelve call sites are swapped to match
the convention the codebase already had. `--color-accent-bg-strong-hover`,
`--color-status-error-strong` and `--color-status-error-strong-hover` are added for the same
reason.

**Alternative rejected — keep one token and darken it in dark.** `accent` would then fail as
text on a dark ground, which is its dominant use.

**Alternative rejected — declare the 14 sites a known exception.** They are the primary buttons.
Shipping them at 2.10:1 is shipping a broken dark mode.

### D-4 · On dark, hover fills lighten; on light, they darken

Both constraints bind at once: white on the fill ≥ 4.5, and the fill ≥ 3.0 against the page so
the control's edge stays visible. On a dark ground a *darker* hover loses page separation
(measured 2.61–2.99), so hover must lighten — the opposite of the light appearance, where
`#6B46C1 → #5B3BA8` darkens. The window is narrow: a white-legible fill can reach at most
~3.74:1 against `app-bg`, and a page-separated fill at least ~5.6:1 under white.

### D-5 · The matrix asserts pairings that occur, not a cartesian product

Every foreground × background combination would over-constrain: `status-info` has no tinted
surface anywhere in the SPA, and forcing it to clear a tint it never renders on would move a
value for no reason. The matrix is built from pairings verified by grep — plain surfaces,
self-tints at the alphas actually used (`/10`, `/8`), `accent` on `accent-bg`, and white on each
fill. Each fill is additionally checked against every opaque surface it renders on — `app-bg`,
`card-bg`, `sidebar-bg` — at the 3.0 non-text floor, resting and hover alike, so a hover fill
cannot darken until the control's edge vanishes. 169 assertions across both appearances.

### D-6 · The `na` chip raises its label rather than moving a text tier

`CoverageCell` renders `bg-text-tertiary/10 text-text-tertiary`, which measures 4.17–4.48 in
light. A 10% tint of a colour under that same colour is inherently ~4:1 unless the colour is
saturated; the status colours clear it only because they are.

**Chosen:** the chip keeps `bg-text-tertiary/10` and raises its label one tier to
`text-text-secondary` (`CoverageCell.tsx:117,120`).

**Alternative rejected — move the chip to `bg-card-bg-hover`** (4.86 light, 5.79 dark). This was
the original choice and it is what earlier drafts of this document and the proposal described;
it is not what shipped. Flattening the chip onto a neutral surface drops it to 1.05:1 against
the card it sits on, so the chip stops reading as a chip — the tint is what distinguishes it,
and the measurement that mattered was the one against the card, not the one against the label.

**Alternative rejected — darken light `text-tertiary`.** It carries a documented tuning history
and a deliberate ~1.11 tier gap below `text-secondary`; darkening it to satisfy one chip would
compress the hierarchy the spec requires be preserved.

### D-7 · `dark:prose-invert` is restored

`HelpLayout.tsx:196` documents why it was removed: the `.dark` class fires app-wide, so with no
dark tokens the modifier rendered white prose on warm paper. Adding the tokens inverts the bug
into light prose on a dark ground. The removal was correct for a product with no dark palette
and is wrong the moment one exists.

### D-8 · `color-scheme` is set per appearance

Without it, UA-rendered chrome — scrollbars, and the native radio inputs in `ThemeToggle` itself
— stays light-styled in dark. The appearance control would visibly fail to restyle itself.

### D-9 · Completeness covers every appearance-scoped token, not only colours

The key-set assertion compares all custom properties the appearance defines, including
`--shadow-card` and `color-scheme`. Scoping it to colour tokens would let a future appearance
forget the shadow and still pass — the exact silent-inheritance defect the assertion exists for.

### D-10 · The contrast test parses both blocks from one file

`tokens.css` stays the single source of truth; the test extracts the `@theme` body and the
`.dark` body separately and runs the same matrix over each. It stays a node-environment
file-parsing test — jsdom does not run Tailwind, so computed-style assertions would test nothing.

## Final values

| token | light | dark |
|---|---|---|
| `app-bg` | `#FAFAF7` | `#1A1721` |
| `sidebar-bg` | `#F8F6F3` | `#151219` |
| `card-bg` | `#FFFFFF` | `#221E2B` |
| `card-bg-hover` | `#FAFAF7` | `#2A2534` |
| `text-primary` | `#1F1B2E` | `#F4F1F8` |
| `text-secondary` | `#6B6478` | `#B3AAC2` |
| `text-tertiary` | `#706B85` | `#A69EB5` |
| `accent` | `#6B46C1` | `#A98BF0` |
| `accent-hover` | `#5B3BA8` | `#BEA6F7` |
| `accent-bg` | `#F2EBFA` | `#2B2340` |
| `accent-bg-strong` | `#6B46C1` | `#7C51DB` |
| `accent-bg-strong-hover` *(new)* | `#5B3BA8` | `#8459E6` |
| `border-subtle` | `#E8E5E0` | `#332D3E` |
| `status-success` | `#2A7354` *(was `#2E7D5B`)* | `#5FBF8E` |
| `status-warning` | `#8F5D18` *(was `#C2802B`)* | `#D9A441` |
| `status-error` | `#B53D3D` | `#EA8181` |
| `status-error-strong` *(new)* | `#B53D3D` | `#BC4545` |
| `status-error-strong-hover` *(new)* | `#8F2F2F` | `#C24B4B` |
| `status-info` | `#5B6FA8` | `#8FA3D9` |

Tightest margins: light `status-info` on `sidebar-bg` at 4.54; dark `accent-bg-strong` on
`card-bg` at 3.15. Tier gaps: light 1.111, dark 1.155.

## Risks / Trade-offs

- **Opacity-modified utilities bake a light hex into their non-`@supports` fallback.** 36
  usages. → **Mitigation:** accepted and recorded; every browser supporting `color-mix`
  (Chrome 111+, Safari 16.2+, Firefox 113+) takes the `var()` path.

- **Every surface changes appearance at once and none has been reviewed in dark.** →
  **Mitigation:** `impeccable:critique` at 1440×900 in dark, composite ≥ 80, artifact committed.
  Value-level fixes it surfaces are in scope for this change; structural ones are not, and get
  filed.

- **The light appearance changes too** — two status colours darken, one chip changes surface.
  Visible to anyone who has chosen light. → **Mitigation:** each is a correction of a measured
  WCAG failure, not a preference change.

- **Three new tokens widen the palette's surface area.** → **Mitigation:** each has one role and
  the completeness assertion forces both appearances to define it.

## Open Questions

- None blocking.
