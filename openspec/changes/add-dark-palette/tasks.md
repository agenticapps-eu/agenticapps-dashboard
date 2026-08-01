# Tasks

TDD throughout: every implementation task is preceded by the assertion that fails without it.
Each pair lands as a `test(RED):` commit followed by `feat(GREEN):` or `fix(GREEN):`.

## 1. Widen the contrast assertion (RED before any token edit)

- [x] 1.1 Extract both appearances from `tokens.css`: parse the `@theme` body and the `.dark` body separately, so one file stays the single source of truth (TDD)
- [x] 1.2 Build the pairing matrix from what occurs in the SPA, not a cartesian product: 8 foregrounds × 4 plain surfaces, self-tints at the alphas actually used (`/10`, `/8`), `accent` on `accent-bg`, `text-secondary` on the chip's `text-tertiary/10` surface
- [x] 1.3 Assert white on each of the four strong fills at 4.5, and each base fill at 3.0 against `app-bg` and `card-bg` so the control edge stays visible
- [x] 1.4 Assert the secondary/tertiary tier gap per appearance, each against its own floor
- [x] 1.5 Assert token-set completeness across **all** appearance-scoped properties, including `--shadow-card` and `color-scheme`, failing with the missing names
- [x] 1.6 Confirm RED and record why each failure fires: no `.dark` block at all; light `status-warning` 4.29 on its own tint; light `status-success` 4.09; light `text-tertiary` 4.17 on the chip

## 2. The dark appearance

- [x] 2.1 Add the `.dark` block to `tokens.css` with the nineteen colour values from `design.md`'s table (GREEN for the dark half of 1.2–1.4)
- [x] 2.2 Give `--shadow-card` a dark value; separation comes from the `app-bg` → `card-bg` step with the shadow reinforcing it
- [x] 2.3 Set `color-scheme` in both appearances so UA chrome — scrollbars, the native radios in `ThemeToggle` — follows (GREEN for 1.5)
- [x] 2.4 Document the appearance inline as `tokens.css` documents the light tiers: measured ratios, and why hover fills lighten on dark and darken on light

## 3. The light corrections

- [x] 3.1 `--color-status-warning`: `#C2802B → #8F5D18`; `--color-status-success`: `#2E7D5B → #2A7354` (GREEN for the light half of 1.2)
- [x] 3.2 Record each prior value and its measured failure in the token's inline history, matching the existing `text-tertiary` history block

## 4. Separate the fill role from the foreground role

- [x] 4.1 Add `--color-accent-bg-strong-hover`, `--color-status-error-strong`, `--color-status-error-strong-hover` to both appearances (GREEN for 1.3)
- [x] 4.2 Swap the twelve `bg-accent text-white` fills to `bg-accent-bg-strong` + `hover:bg-accent-bg-strong-hover`, matching the convention `SidebarItem` already documents
- [x] 4.3 Swap the two destructive buttons to `bg-status-error-strong` + `hover:bg-status-error-strong-hover`, removing `hover:bg-red-700`
- [x] 4.4 Raise the `CoverageCell` "scan failed" chip's label one tier; flattening the chip onto a neutral surface would drop it to 1.05:1 against the card
- [x] 4.5 Test: no component pairs `text-white` with a foreground-role token; assert by scanning `src/components/**` so the regression cannot return

## 5. The help docs

- [x] 5.1 Restore `dark:prose-invert` on `HelpLayout`'s article, replacing the comment that explains why it was removed with one explaining why it is back
- [x] 5.2 Test: the article carries the modifier, so a future removal fails rather than silently inverting the docs

## 6. Confirm nothing else moved

- [x] 6.1 `tokenSourceOfTruth.test.ts` green — hex literals still confined to `tokens.css`
- [x] 6.2 `noOrange.test.ts` green — no corrected value is a banned literal
- [x] 6.3 Full SPA suite green: `pnpm --filter @agenticapps/dashboard-spa test`
- [x] 6.4 `pnpm -r typecheck` and `pnpm lint` clean

## 7. Look at it

- [x] 7.1 Boot the dev server; screenshot a representative route in dark and light at 1440×900 — found and fixed a cascade-order bug the suite could not see
- [x] 7.2 Verify `/settings` now visibly restyles, including its own native radios, and that the choice survives a reload
- [x] 7.3 Verify the help docs render dark prose on a dark ground
- [x] 7.4 `impeccable:critique` at 1440×900 in dark, composite ≥ 80, artifact committed — 88, PASS, with coverage and isolation caveats recorded
- [x] 7.5 Fix value-level findings from the critique; file structural ones — inert dark shadow replaced with an inset edge highlight; PRODUCT.md's appearance-of-record corrected; /help stubs and settings dead space filed as pre-existing

## 8. Close the change

- [x] 8.1 `openspec validate --all` green — 18/18
- [ ] 8.2 Two-stage review: gstack `/review`, then `superpowers:requesting-code-review` in an independent context
- [x] 8.3 Re-run `run-plan-review.sh` and confirm the three REQUEST-CHANGES verdicts are addressed or answered in writing

### 8.3 disposition — the second review round

The first round's command was wrong: `--implementing-host claude` is not a flag,
and `REVIEWERS=("$@")` took it as the reviewer list, so both entries were skipped
silently (`claude` as SELF, `--implementing-host` as a missing executable) and
`REVIEWS.md` was left untouched. Re-run as `run-plan-review.sh add-dark-palette`;
three reviewers returned against the revised artifacts, all REQUEST-CHANGES.

Verified and fixed:

- [x] 8.3a **Hover fills were never held to the 3.0 non-text floor** (codex, opencode).
      Only `RESTING_FILLS` were, and only against `app-bg`/`card-bg`; the sidebar
      active pill — the canonical fill — sat on an unasserted `sidebar-bg`. Now all
      four fills are checked against all three surfaces they actually render on.
      Measured: dark 3.15–4.02, light 5.26–8.03. `card-bg-hover` is excluded because
      no filled control renders on a hovered card (2.87 there, a pairing that does
      not occur). +16 assertions, 148 → 169.
- [x] 8.3b **D-6 documented a decision that did not ship** (codex, opencode). design.md
      said the chip "moves to `bg-card-bg-hover`"; the code kept the tint and raised
      the label. The shipped choice is now the chosen one and the neutral surface is
      recorded as the rejected alternative, with the 1.05:1 measurement that rejected it.
- [x] 8.3c **"Four shipping light values are corrected" — only two exist** (codex,
      opencode). Factual error in the proposal; corrected to two.
- [x] 8.3d **`global.css:5` still said the dark variant "does nothing without a `.dark{}`
      block"** (opencode) — the very sentence the proposal quotes as motivation, false
      as of this change. Corrected.

Answered, not actioned:

- [x] 8.3e **`fillRole.test.ts` same-string evasion** (opencode). Real, but the named
      evasion — `clsx('text-white', active && 'bg-accent')` — is not an available
      pattern: cn()/clsx/CVA are banned by D-5.1-10. A file-scope widening was
      implemented and reverted: it flags `SidebarSubItem`, where `bg-status-success`
      is a status dot carrying no text. The limitation and the reverted attempt are
      now recorded in the test's own doc comment rather than left implied.
- [x] 8.3f **Pairing-matrix drift is unguarded** (codex, opencode). True and accepted:
      the matrix is grep-verified by hand, so a new pairing is unasserted until someone
      adds it. Automating usage→matrix reconciliation is a larger change than this one
      and is not attempted here.
- [x] 8.3g **Focus-ring and disabled-state contrast floors** (gemini, opencode minor).
      Out of scope — this change defines a palette, not the focus and disabled systems.
      Rings measure ~5.9:1 in dark today; unguarded, and worth its own change.
- [x] 8.3h **`color-scheme` is asserted separately, not in the key-set check** (codex,
      opencode). Accurate reading of the mechanism. The scenario holds for the two
      appearances that exist; a canonical scope for future appearance-dependent
      namespaces is deferred rather than invented now.
- [x] 8.3i **`color-mix` fallback needs a supported-browser baseline** (codex). Already
      recorded in design.md Risks as accepted; no baseline contract is added here.
- [ ] 8.4 Fold the `design-system` delta into `openspec/specs/design-system/spec.md` and archive
- [ ] 8.5 Open the PR; note that `feat/repo-readiness-vocabulary` rebases onto this before §8 resumes
