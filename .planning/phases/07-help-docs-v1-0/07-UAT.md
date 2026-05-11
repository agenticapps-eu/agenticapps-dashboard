---
phase: 07
slug: help-docs-v1-0
status: drafted
authored: 2026-05-11
---

# Phase 7: /help docs v1.0 — Manual UAT

> Human-only checklist for behaviors that automation can't fully assert.
> Source: 07-VALIDATION.md §"Manual-Only Verifications" + the migration
> reviewer checklist + 07-VERIFICATION.md.

The four manual-only behaviors per Plan 07-05's validation map:

## 1. Visual coherence at lg (1440×900) vs the migration design intent

**What to check:** the docs site renders as the migration's `_shell/HelpLayout.tsx` intended:

- Warm-paper background (`--color-app-bg` `#FAFAF7`)
- Sidebar at `w-72` with all 5 NAV sections (Workflow, Repositories, Observability, Operations, Reference)
- Main content `max-w-3xl` prose
- Purple accent (`--color-accent` `#6B46C1`) on active nav links + headings
- Search input disabled with "(coming in v1.1)" placeholder hint
- Mermaid diagrams as SVG, not raw fenced code

**How to verify:**

1. Run `pnpm --filter @agenticapps/dashboard-spa preview --port 5174` (or use the running dev server from Playwright).
2. Open http://localhost:5174/help in a real browser at 1440×900.
3. Click through each ready anchor (landing, workflow/overview, repos/overview, observability/overview, operations/install, reference/shortcuts).
4. Cross-check against the screenshots in `evidence/help-*-lg.png`.

**Result (filled in during walkthrough):**

- [ ] Sidebar composition + token usage matches design intent.
- [ ] Main article prose readable (dark slate body + headings on warm paper after the 0ce906a fix).
- [ ] Active link uses purple accent on the current path.
- [ ] Mermaid diagrams render as crisp SVG (no raw fenced-code text leaks).

Notes:

- Any visual delta? Log as info-level findings in `07-05-SUMMARY.md` once authored.

## 2. Mermaid diagram readability at lg + mobile breakpoints

**What to check:** all 5 fenced Mermaid blocks (landing, workflow/overview, repos/overview, observability/overview ×2, operations/install reads no Mermaid) fit in their container at both viewports without overflow.

**How to verify:**

1. Visit each route at lg (1440×900) and mobile (375×800).
2. Inspect the SVG bounds: width should be ≤ container width; no horizontal scrollbar should appear inside the article.
3. Text labels inside diagrams should remain legible at mobile (≥ 12px effective).

**Result:**

- [ ] Landing Mermaid (linear flow `Idea → Brainstorm → Plan → Execute → Verify → Review → Ship`) — readable lg + mobile.
- [ ] workflow/overview Mermaid — readable lg + mobile.
- [ ] repos/overview Mermaid — readable lg + mobile.
- [ ] observability/overview Mermaid 1 — readable lg + mobile.
- [ ] observability/overview Mermaid 2 — readable lg + mobile.

Any overflow? Log as info-level finding.

## 3. `?` keyboard shortcut keypress check (post-merge, real session)

**What to check:** in a real paired dashboard session, pressing `?` from `/` navigates to `/help` and the docs landing renders.

**How to verify:**

1. Pair the daemon (`agentic-dashboard pair`) and load the dashboard in a real browser.
2. On `/`, press the `?` key (Shift+/ on US keyboards).
3. Verify URL changes to `/help` AND the docs landing page renders.

**Known caveat (flagged for v1.0.1):** `useGlobalShortcuts.ts:49` bails on any shift/ctrl/meta/alt modifier. On a US keyboard, typing `?` requires Shift+/, which means the hook never fires the navigation. The Playwright test passes because `page.keyboard.press('?')` synthesises a `keydown` with `key='?'` and `shiftKey=false` (bypassing OS layout). Real users on US/most international layouts may need a follow-up patch.

**Result:**

- [ ] `?` from `/` navigates to `/help` (real keyboard).
- [ ] Landing renders, not redirected to /onboarding.
- [ ] If `?` doesn't fire: confirm the keyboard-layout caveat above; log as bug for v1.0.1.

## 4. Dark-mode prose verification (deferred to v1.1)

**Status:** explicitly deferred per CONTEXT.md `<deferred>` + the 0ce906a fix that removed `dark:prose-invert` from HelpLayout for v1.0 ship.

**Why deferred:**

- The dashboard's theme system (`lib/theme.ts`) defaults to `dark` mode (D-02) and adds the `.dark` class to <html>.
- Phase 7 CONTEXT.md assumed v1.0 ships "no `.dark{}` block; `dark:prose-invert` is dormant" — this was incorrect; the class IS present app-wide.
- Until a proper dark prose palette is designed (warm-paper analog for dark mode), the docs site renders light prose unconditionally.

**v1.1 follow-up:** design a dark-mode prose palette that matches the warm-paper tokens, then reinstate `dark:prose-invert` (or a custom dark-mode prose class).

**Result for v1.0:**

- [x] Dark-mode prose intentionally not shipped in v1.0 (documented + tested).

## Reviewer checklist walkthrough (post-merge gate)

Per CLAUDE.md mandate + the migration spec's §"Verification before merge":

- [ ] Open PR against `main`.
- [ ] Walk through Playwright spec items 1–8 manually one more time in a fresh browser (post-merge).
- [ ] Run `/review` (Stage 1 gstack review on the phase diff).
- [ ] Run `superpowers:requesting-code-review` (Stage 2 deep review in a fresh Claude session).
- [ ] Run `/qa` against the dev server if reachable on localhost.
- [ ] If any phase touched auth/storage/API/LLM, run `/cso`. (Plan 07-05 did not — pure docs site, no daemon interaction. Skip.)

## Sign-off

- [ ] **User sign-off** (Donald) — visual + UX + shortcut behavior approved.
- [ ] **Two-stage review** (post-merge) — both stages pass.
- [ ] **Documented issues** — any items flagged above as "log as info-level finding" are captured in `07-05-SUMMARY.md`.
