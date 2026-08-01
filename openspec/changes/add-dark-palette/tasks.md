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
- [ ] 7.4 `impeccable:critique` at 1440×900 in dark, composite ≥ 80, artifact committed
- [ ] 7.5 Fix value-level findings from the critique; file structural ones

## 8. Close the change

- [ ] 8.1 `openspec validate --all` green
- [ ] 8.2 Two-stage review: gstack `/review`, then `superpowers:requesting-code-review` in an independent context
- [ ] 8.3 Re-run `run-plan-review.sh` and confirm the three REQUEST-CHANGES verdicts are addressed or answered in writing
- [ ] 8.4 Fold the `design-system` delta into `openspec/specs/design-system/spec.md` and archive
- [ ] 8.5 Open the PR; note that `feat/repo-readiness-vocabulary` rebases onto this before §8 resumes
