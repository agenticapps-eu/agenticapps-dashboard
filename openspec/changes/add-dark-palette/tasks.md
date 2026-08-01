# Tasks

TDD throughout: every implementation task is preceded by the assertion that fails without it.
Each pair lands as a `test(RED):` commit followed by `feat(GREEN):` or `fix(GREEN):`.

## 1. Widen the contrast assertion (RED before any token edit)

- [ ] 1.1 Extract both palettes from `tokens.css`: parse the `@theme` body and the `.dark` body separately, so one file stays the single source of truth (TDD)
- [ ] 1.2 Assert 7 text-bearing tokens (3 text tiers, 4 status colours) × 4 backgrounds (`app-bg`, `sidebar-bg`, `card-bg`, `card-bg-hover`) × 2 appearances against their floors
- [ ] 1.3 Assert the accent against the same matrix — it carries link and control text
- [ ] 1.4 Assert the secondary/tertiary tier gap per appearance, each against its own floor, so neither collapses
- [ ] 1.5 Assert token-set completeness: the two appearances define exactly the same token names, failing with the missing names
- [ ] 1.6 Confirm RED for both reasons independently — dark extraction finds no `.dark` block, and light `status-warning` scores 3.03 against `sidebar-bg`

## 2. The dark palette

- [ ] 2.1 Add the `.dark` block to `tokens.css` with all sixteen colour tokens at the palette-A values (GREEN for the dark half of 1.2–1.5)
- [ ] 2.2 Give `--shadow-card` a dark value; card separation comes from the `app-bg` → `card-bg` surface step with the shadow reinforcing it
- [ ] 2.3 Document the palette inline as `tokens.css` already documents the light tiers: measured ratios, and why the tier gap differs between appearances

## 3. The light correction

- [ ] 3.1 `--color-status-warning`: `#C2802B` → `#96601C` (GREEN for the light half of 1.2)
- [ ] 3.2 Record the prior value and its measured 3.03–3.27 in the token's inline history, matching the existing `text-tertiary` history block

## 4. Confirm nothing else moved

- [ ] 4.1 `tokenSourceOfTruth.test.ts` green — hex literals still confined to `tokens.css`, no component edited
- [ ] 4.2 `noOrange.test.ts` green — `#96601C` is not a banned literal and the dark palette introduces none
- [ ] 4.3 Full SPA suite green: `pnpm --filter @agenticapps/dashboard-spa test`
- [ ] 4.4 `pnpm -r typecheck` and `pnpm lint` clean

## 5. Look at it

- [ ] 5.1 Boot the dev server and screenshot a representative route in dark and in light at 1440×900
- [ ] 5.2 Verify the `/settings` appearance control now visibly changes the interface, and that the choice survives a reload
- [ ] 5.3 `impeccable:critique` at 1440×900 in dark, composite ≥ 80, artifact committed
- [ ] 5.4 Address anything the critique raises above the floor, or record the structural-debt waiver

## 6. Close the change

- [ ] 6.1 `openspec validate --all` green
- [ ] 6.2 Two-stage review: gstack `/review`, then `superpowers:requesting-code-review` in an independent context
- [ ] 6.3 Fold the `design-system` delta into `openspec/specs/design-system/spec.md` and archive
- [ ] 6.4 Open the PR; note that `feat/repo-readiness-vocabulary` rebases onto this before §8 resumes
