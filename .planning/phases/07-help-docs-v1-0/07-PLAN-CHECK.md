# Phase 7 Plan Check — Goal-Backward Verification

**Phase:** 07 — Help docs v1.0
**Plans checked:** 5 (07-01 → 07-05)
**Total tasks:** 39 (07-01: 8; 07-02: 8; 07-03: 4; 07-04: 7; 07-05: 12)
**Plan-checker:** gsd-plan-checker
**Date:** 2026-05-11
**Branch:** feat/help-docs-v1

---

## Verdict

**PASS-WITH-FLAGS** — commit as-is is acceptable; address the listed flags during execution or in the per-task GREEN commits. No BLOCKERS.

The plans are unusually thorough (RED→GREEN cycles, threat models per plan, exhaustive token-translation tables, an exact 41-entry helpRouteTable, a Playwright walking checklist that mirrors the reviewer's manual gate). I did find one inconsistency between VALIDATION.md and the actual task count (38 rows in VAL.md vs 39 tasks in the plans), and a couple of authoring hazards that the executor must navigate carefully. None of them risks Phase 7 failing to deliver its goal.

---

## Per-Success-Criterion Coverage (S1..S8)

| # | Criterion | Delivering plan/tasks | Verdict |
|---|-----------|-----------------------|---------|
| S1 | `pnpm --filter spa dev` + `/help` renders landing MDX (3 nav cards + intro + Mermaid) | 07-01-T2 (vite MDX plugin) → 07-02-T6 (HelpLayout) → 07-04-T1 (landing.mdx) → 07-05-T2 (landing.lazy) + T4 (router wiring) + T9 (Playwright e2e visiting `/help`) | **Strong** |
| S2 | All 5 anchor pages render Mermaid (no console errors) | 07-02-T5 (MermaidBlock with `console.warn` per RESEARCH P6) + 07-04-T4 (mermaid.parse syntax test) + 07-04-T5 (RTL render smoke) + 07-05-T7/T9 (Playwright anchor walk asserts `errors === []`) | **Strong** |
| S3 | Each of ~25 stub paths renders ComingSoon with correct back-link | 07-02-T3 (ComingSoon component + 7 unit tests incl. operations special case) → 07-05-T1 (helpRouteTable: 29 stubs) → 07-05-T3 (ComingSoonRoute factory) → 07-05-T9 (Playwright 3-sample test). Note: ROADMAP says "~25"; plans deliver **29** stubs (workflow 11 incl. D-7-13 + repos 6 + obs 7 + ops 4 + ref 4). The extra 4 are scope additions beyond the ROADMAP estimate — fine, since they were planned. | **Strong** |
| S4 | `/help/workflow|repos|observability` redirect to `/overview`; `/help/operations` → `/install` | 07-05-T1 (4 redirect entries in helpRouteTable) + 07-05-T3 (buildHelpRoutes `redirect` branch with `throw redirect({to})`) + 07-05-T7/T9 (Playwright `REDIRECT_PAIRS` test) | **Strong** |
| S5 | `<HelpWidget name="RepoTopologyMap" />` (repos/overview), `name="ScanReportPlayground"` (observability/overview), `name="MigrationDryRun"` (operations/install) dispatch via React.lazy | 07-02-T4 (HelpWidget lazy dispatch table with 8 entries verified by `grep -c "lazy(() => import"` returns 8) + 07-03-T2 (8 `.stub.tsx` files exist) + 07-03-T3 (8-stub smoke render passes) + 07-04-T1 (the 3 HelpWidget JSX references preserved in MDX; verified by acceptance grep) + 07-04-T5 (anchor-pages test mocks the 3 specific stubs and asserts they render) + 07-05-T9 (Playwright "Coming v1.2 badge visible after Suspense" assertion on `/help/repos/overview`). **All 3 specific embed sites covered.** | **Strong** |
| S6 | `?` shortcut still pushes `/help` AND lands on docs landing | Verified `packages/spa/src/lib/useGlobalShortcuts.ts` line 62: `if (e.key === '?') { e.preventDefault(); void navigate({ to: '/help' }) }` — D-7-01 mandates NO change to this hook (confirmed in CONTEXT.md line 39, code unchanged). The legacy `/help` route is deleted in 07-05-T4 (with `legacy-help-route-deleted.test.ts` guard) and replaced by the docs `_helpLayout` peer route mounted at `/` index. After the swap, `navigate({to:'/help'})` resolves to the new index route. 07-05-T9 Playwright explicitly tests "`?` shortcut from `/` lands on `/help` docs landing". | **Strong** |
| S7 | Dark mode renders correctly (`prose-invert` via Tailwind v4 plugin) | 07-01-T3 (`@plugin "@tailwindcss/typography";`) + 07-02-T6 HelpLayout uses `prose prose-slate dark:prose-invert max-w-none`. **CAVEAT:** Phase 6 ships NO `.dark{}` block (per CONTEXT.md line 116 — `dark:prose-invert` is dormant in v1.0). VALIDATION.md acknowledges this as a v1.1 verification item; the dark-variant directive is present (global.css `@custom-variant dark`). Plans deliver the *plumbing* but cannot deliver runtime evidence until v1.1 enables dark mode. | **Acceptable** (with caveat) — see Flag F-04 |
| S8 | typecheck/test/lint green + MDX chunks emitted + PR opens against `main` + two-stage review + impeccable ≥ 90 on `/help` (lg 1440x900) | 07-05-T8 (pre-flight `pnpm -r typecheck && pnpm -r test && pnpm lint && pnpm -r build`) + 07-05-T10 (impeccable gate checkpoint, blocking) + 07-05-T11 (browse screenshots) + 07-05-T12 (VERIFICATION.md + UAT.md). PR-against-`main` is enforced by branching off `origin/main` (D-7-02 confirms branch base; current branch is `feat/help-docs-v1`). Two-stage review is gated by project ~/.claude/CLAUDE.md post-phase hook. | **Strong** |

---

## Per-Plan Brief Assessments

### 07-01 (Wave 0 infra) — Solid foundation

8 tasks covering: 7 catalog deps with validated versions (R1.x), Vite MDX plugin with 3 explicit ordering invariants, Tailwind v4 `@plugin` directive at exact line position, `*.mdx` ambient type, end-to-end smoke (RED→GREEN), tokenSourceOfTruth scope extension to `src/help/**`, playwright.config + `e2e/` dir, REQUIREMENTS.md HELP-01..06 appended with 6 traceability rows. The plan's ordering invariants (mdx FIRST + `enforce:'pre'`, plugin-react `include` widened, tailwindcss LAST) are explicit and acceptance-grep-tested. **Wave 0 is sufficient** to unblock Waves 1+ (see "Wave 0 Sufficiency Check" below).

### 07-02 (Wave 1 shell components) — Comprehensive but watch the Mermaid theme

8 tasks delivering 5 shell components + topicToUrl + mdxComponents (4 entries). Token translation table is exhaustive; TanStack routing translation table is explicit. ~38 unit tests across 5 component files + topicToUrl table-driven (9 cases). **Two authoring hazards** flagged below: (a) `MermaidBlock.tsx` task body presents Option A as remediation prose after showing a hex-literal-laden code block — executor must follow the remediation, not the first code block; the acceptance criteria explicitly fail if hex literals remain. (b) `HelpHook.tsx` acceptance criteria contain a regex that looks for shadcn-class leaks but the comment hedge ("but `bg-card-bg`, `text-text-primary` etc must NOT match") signals the planner is aware the regex `(bg|text|border)-(background|foreground|primary|secondary|destructive|muted|accent|card)\b` will match dashboard tokens like `bg-card-bg` and produce false positives — the executor should treat it as guidance not a hard gate. Both flagged below.

### 07-03 (Wave 1 widget stubs) — Lean and disjoint

4 tasks; 11 files (1 primitive + 8 stubs + 1 primitive test + 1 smoke test). All 8 emojis verified against migration source. Gradient `bg-gradient-to-br from-muted/30 to-muted/60` correctly flattened to `bg-sidebar-bg`. **Parallel-safe with 07-02** — `comm -12` of the two `files_modified` sets returned empty (confirmed below). Smoke test imports all 8 default exports with 8 it.each cases, covering all 3 ROADMAP S5 embed sites plus the 5 v1.1 backlog widgets.

### 07-04 (Wave 2 content) — Content-faithful with one strategic deviation

7 tasks delivering 6 MDX files + 4 test files (~22 new tests). **Strategic decision:** Mermaid is JSX `<MermaidBlock code={...}/>` instead of fenced ` ```mermaid `, because 07-05 ships the `pre: MermaidPreOrDefault` mapping as defensive belt-and-suspenders (Plan 07-04 doesn't depend on it). The executor must hand-transform 5 mermaid blocks (landing 1 + workflow 1 + repos 1 + observability 2 + operations 0) when copying — explicit in 07-04-T1. mermaid.parse syntax-validation test (`@vitest-environment node`) catches syntax errors at commit time. HELP-06 evidence (KbdHint chips for R / ? / / / Cmd+K) is direct in 07-04-T6.

### 07-05 (Wave 3 routing + closing ritual) — The decisive plan

12 tasks. Mix of autonomous (T1–T8) and human-verify checkpoints (T9–T12, all `gate="blocking"`). The 41-entry helpRouteTable is locked by snapshot test (T1) with explicit assertions on D-7-13 paths and HELP-06 anchor status. buildHelpRoutes factory handles all 5 entry kinds with TanStack `createRoute` + `redirect({to})` + `path:'$'` catch-all. `_helpLayout` correctly mounted as PEER of `_appshell` at `rootRoute` (D-7-12). Legacy `/help` deletion guarded by file-existence test. Playwright walking checklist has 7 tests on desktop + 1 mobile project. **Critical observation:** T6 (impeccable.yml route list) is effectively a no-op — I verified `.github/workflows/impeccable.yml:86` already contains `ROUTES="/ /projects/demo /settings /help /onboarding /pair"`. The task correctly anticipates this with "if /help is present: log 'already included' and skip".

---

## Parallel-Safety Check — 07-02 vs 07-03

```
07-02 files_modified  ∩  07-03 files_modified  =  ∅   (empty intersection)
```

Verified by `comm -12`. 07-02 writes to `packages/spa/src/help/components/**` + `topicToUrl.{ts,test.ts}` + `mdxComponents.ts`. 07-03 writes to `packages/spa/src/help/widgets/**`. **Truly disjoint.** The R2 resolution (07-02 mocks the 8 widget stub imports via `vi.mock('../widgets/<Name>.stub')`) means 07-02's HelpWidget.test.tsx can run before 07-03's stubs land. Plan 07-03-T4 explicitly re-runs 07-02's HelpWidget test as part of its workspace verification after both lands.

**Verdict: PARALLEL-SAFE.** Run 07-02 and 07-03 concurrently with confidence.

---

## Wave 0 Sufficiency Check — Does 07-01 Unblock 07-02..05?

| Wave 1+ need | Provided by 07-01 task | OK? |
|--------------|------------------------|-----|
| `pnpm-workspace.yaml` has @mdx-js/react/rollup, remark-*, @tailwindcss/typography, mermaid | T1 (7 catalog entries with `^3.1.1`, `^5.0.0`, etc.) | ✅ |
| Vite compiles `.mdx` → JSX before React Refresh | T2 (mdx plugin enforce:'pre', plugin-react regex widened) | ✅ |
| `prose` class resolves at build time | T3 (`@plugin "@tailwindcss/typography"` after `@import tailwindcss`) | ✅ |
| `import X, { frontmatter } from './x.mdx'` typechecks | T4 (ambient module declaration) | ✅ |
| `<MDXProvider>` wraps `<RouterProvider>` so `<HelpWidget>`/`<HelpHook>` etc. resolve in MDX | T5 (main.tsx update) | ✅ |
| 07-02/07-03 component files protected from hex-literal leaks | T6 (tokenSourceOfTruth extended to walk `src/help/**`) | ✅ |
| 07-05 can run Playwright e2e | T7 (playwright.config.ts + `e2e/` dir + chromium-desktop 1440x900 + chromium-mobile 375x800) | ✅ |
| VERIFICATION.md (07-05-T12) has HELP-01..06 anchors to cite | T8 (REQUIREMENTS.md appended with 6 entries + 6 traceability rows) | ✅ |
| 07-02-T7 finalising `mdxComponents.ts` finds an existing stub | T5 creates the empty stub | ✅ |

**Verdict: Wave 0 fully unblocks Waves 1+.** Every artefact Waves 1–3 need is created (or extended in place) by 07-01.

---

## Flags (should address; not blocking)

### F-01 — Authoring hazard: MermaidBlock hex literals in plan body

**Plan:** 07-02 Task 5

**Issue:** The task body presents the MermaidBlock implementation as two stacked code blocks — the first declares a `MERMAID_THEME_VARIABLES` constant containing 4 hex literals (`#F2EBFA`, `#1F1B2E`, `#6B46C1`, `#9C95A8`); the second presents Option A which replaces that constant with a `getMermaidThemeVariables()` function reading from `getComputedStyle(document.documentElement)`. A careless executor could copy-paste the first block and ship hex literals, which would fail `tokenSourceOfTruth.test.ts` (Plan 07-01-T6 extends it to walk `src/help/**`).

**Mitigation already in plan:** Acceptance criteria item explicitly fails on `grep -qE '#[0-9a-fA-F]{3,8}\b' packages/spa/src/help/components/MermaidBlock.tsx`. So the executor will discover the issue at verify-time and re-edit.

**Fix hint for executor:** When writing MermaidBlock.tsx, skip directly to Option A (the `getMermaidThemeVariables()` function). Do NOT commit a version with hex literals first.

### F-02 — Acceptance regex with documented false positives

**Plan:** 07-02 Task 2 (HelpHook) and similar in other 07-02 tasks

**Issue:** The acceptance criterion `! grep -qE "(bg|text|border)-(background|foreground|primary|secondary|destructive|muted|accent|card)\\b"` is documented in its own comment as having false positives ("but `bg-card-bg`, `text-text-primary` etc must NOT match"). The regex DOES match `bg-card-bg` (`bg-card` is a prefix). The planner suggests "verify by running `grep -oE ... | sort -u` and inspecting output is all tokens.css names" as the actual check.

**Fix hint for executor:** Treat the negative grep as a *suggestion*, not a hard gate. The hard gate is the second-listed check: `grep -oE "(bg|text|border)-[a-z]+(-[a-z]+)*(/[0-9]+)?" file | sort -u` and inspect that every result is a tokens.css name (e.g. `bg-app-bg`, `text-text-primary`, `border-border-subtle`). The `tokenSourceOfTruth.test.ts` invariant + the `grep -rE` from the plan's `<verification>` (looking for shadcn class forms) is the canonical gate.

### F-03 — VALIDATION.md count off-by-one

**Plan:** 07-VALIDATION.md (the verification map, not a PLAN file)

**Issue:** VALIDATION.md claims "**38 task rows filled.**" in the sign-off (line 123), but the 5 plans contain **39 tasks total** (07-01: 8 + 07-02: 8 + 07-03: 4 + 07-04: 7 + 07-05: 12 = 39). VALIDATION.md per-task table appears to cover all 39 tasks (rows for 07-01-T1..T8, 07-02-T1..T8, 07-03-T1..T4, 07-04-T1..T7, 07-05-T1..T12 — I counted 39 rows in the table). The "38 task rows" claim in the sign-off is a typo or off-by-one count of T1..T12 (which is 12 rows for 07-05, not 11).

**Fix hint:** Either update sign-off line 123 to "39 task rows filled" or rename Tasks 11/12 in 07-05 (less attractive — they're useful as separate checkpoints). Low priority since the table itself is complete.

### F-04 — Dark mode (S7) not verifiable in v1.0

**Plan:** 07-02-T6 + 07-05 verification

**Issue:** ROADMAP S7 says "Dark mode renders correctly on every help route." The plans ship `dark:prose-invert` in HelpLayout's `<article>` and `@custom-variant dark` in global.css, but v1.0 has no `.dark{}` block enabled. VALIDATION.md "Manual-Only Verifications" explicitly defers dark-mode verification to v1.1 ("Can't verify automatically until v1.1 enables dark mode"). CONTEXT.md doesn't acknowledge this S7 gap explicitly.

**Fix hint:** 07-05-T12's VERIFICATION.md template (line 1106) handles this: "Dark mode renders correctly (dormant in v1.0) | Documented in CONTEXT.md `<deferred>`; v1.1 verification". So the gap is documented — but the executor should make sure the VERIFICATION.md S7 row reflects this caveat clearly, not just stamp it ✅.

### F-05 — Stub count: ROADMAP says "~25", plans deliver 29

**Plan:** 07-05-T1 (helpRouteTable: 29 stubs)

**Issue:** ROADMAP Phase 7 says "~25 stub paths". CONTEXT.md `<domain>` line 14 says "~25 stub paths (workflow x9, repos x6, observability x7, operations x4, reference x4 + 2 newly-required workflow stubs)". The "+2" reference is D-7-13 (rationalization-table + red-flags). Math: 9+6+7+4+4+2 = 32. But the actual helpRouteTable in 07-05-T1 has workflow 11 (9 base + D-7-13's 2 = 11) + repos 6 + observability 7 + operations 4 + reference 4 = **32** stubs. **Wait — but the snapshot test asserts 29**. Let me recount from the plan:

```
// Workflow (11) — 9 base + D-7-13's 2
commitment-ritual, gates, superpowers, gsd, gstack, impeccable, two-stage-review, verification, adrs, rationalization-table, red-flags = 11 ✓
// Repos (6)
core, claude, pi, codex, dashboard, projects = 6 ✓
// Observability (7)
spec-section-10, stacks, install, scan, apply, policy, pi-codex-status = 7 ✓
// Operations (4)
update, slash-commands, troubleshooting, migration-runbook = 4 ✓
// Reference (4) — shortcuts is anchor, not stub
glossary, adr-index, changelog, contributing = 4 ✓
Total = 11+6+7+4+4 = 32
```

But the snapshot test in 07-05-T1 asserts `stub: 29`. The 41-total breakdown is `1 index + 6 anchor + 29 stub + 4 redirect + 1 catchAll = 41`. **Math mismatch:** plan body table has 32 stubs but snapshot expects 29. The plan acceptance grep `grep -c '/help/workflow/' packages/spa/src/help/helpRouteTable.ts returns ≥ 12` (1 overview + 11 stubs = 12 matches in workflow alone) confirms the larger count of 11 workflow stubs.

**This is a snapshot-vs-source-of-truth inconsistency that WILL fail the snapshot test as written.** Either the snapshot needs updating (to 32) or the stub list needs pruning (to 29). The plan body says both — that's the discrepancy.

**Fix hint:** Before committing, decide which is canonical. If 32 stubs (current plan body) is correct, update the helpRouteTable.test.ts snapshot expectation from `stub: 29` to `stub: 32` and the total from `41` to `44`. Alternatively, identify 3 stubs to drop. Recommend going with **32 stubs / 44 total** because (a) D-7-13 explicitly demands rationalization-table + red-flags, (b) HelpLayout.tsx NAV in 07-02-T6 lists 11 workflow stubs (matches the source migration), and (c) "all internal /help/* links resolve" reviewer checklist item depends on each NAV entry having a route. This is **NOT blocking** because it surfaces immediately on the first test run (snapshot mismatch), but it does mean 07-05-T1 will need a small revision during execution.

### F-06 — Two manual checkpoint plans (07-05 T9–T12) need a user that's online

**Plan:** 07-05 closing ritual

**Issue:** 4 of 12 tasks in 07-05 are `checkpoint:human-verify` with `gate="blocking"`. The orchestrator must coordinate with the user for: Playwright run-and-inspect (T9), impeccable score gate (T10), screenshot review (T11), VERIFICATION+UAT sign-off (T12). The plan explicitly sets `autonomous: false` in 07-05 frontmatter (line 8) to communicate this. **No fix needed — well-flagged in the plan itself.** Just confirming the executor session must include human availability for 4 stop-points.

---

## TDD Discipline Check

| Plan | TDD tasks | RED→GREEN evidence required |
|------|-----------|------------------------------|
| 07-01 | 1 (T5: MDX smoke) | Explicit two-commit cycle: `test(07-01): RED smoke` then `feat(07-01): GREEN` |
| 07-02 | 6 (T1, T2, T3, T4, T5, T6) | Every TDD task has explicit "Run: fails. Commit `test(07-02): RED ...`" + "Run test: passes. Commit `feat(07-02): GREEN ...`" |
| 07-03 | 2 (T1, T3) | T1 explicit RED→GREEN; T3 marked TDD but plan says "RED phase was implicit" because the test file references stubs created in T2 — pragmatic deviation |
| 07-04 | 4 (T3, T4, T5, T6) | All 4 tests pass on first run because MDX files already exist from T1/T2. The "RED" phase here is content-validation rather than implementation — acceptable variant. |
| 07-05 | 2 (T1, T4) | T1 explicit RED→GREEN snapshot; T4 explicit RED (file-existence test fails before deletion) → GREEN (after deletion) |

**Verdict:** TDD discipline is honoured where it makes sense. 07-03-T3 and 07-04-T3..T6's "implicit RED" pattern (test fails because it references modules/files that don't exist yet) is acceptable given the file ordering — those are test-first contracts in spirit.

---

## Migration Spec Adherence

The MIGRATION-INSTRUCTIONS.md (~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/MIGRATION-INSTRUCTIONS.md) is 12 steps; the plans translate to the dashboard's stack:

- **Steps 1–4** (npm install, file copy) → 07-01-T1 (pnpm catalog) + 07-02 token-translation table
- **Step 5** (split _stub-pattern.tsx) → 07-03-T1+T2
- **Step 6** (router) → 07-05-T1+T3+T4
- **Step 7** (Vite plugin) → 07-01-T2
- **Step 8** (Tailwind plugin) → 07-01-T3
- **Step 9** (Mermaid runtime) → 07-02-T5
- **Step 10** (MDXProvider) → 07-01-T5
- **Step 11** (reviewer checklist) → 07-05-T7+T9
- **Step 12** (PR + review) → 07-05-T12 (VERIFICATION.md + UAT.md + two-stage review)

Documented adaptations (per CONTEXT.md D-7-04..D-7-12): react-router-dom → TanStack, npm → pnpm catalog, Tailwind v3 → v4 `@plugin`, single-package → `packages/spa/`. **All adaptations are intentional and documented.**

---

## Structured Issues

```yaml
issues:
  - dimension: scope_reduction
    severity: flag
    plan: "07-05"
    task: 1
    description: "helpRouteTable.test.ts snapshot expects 29 stubs but plan body lists 32 (workflow 11 + repos 6 + obs 7 + ops 4 + ref 4)"
    fix_hint: "Update snapshot expectation to 32 stubs / 44 total (1 index + 6 anchors + 32 stubs + 4 redirects + 1 catchAll). Stub count should follow D-7-13 + migration source, not the ROADMAP's '~25' estimate."

  - dimension: task_completeness
    severity: flag
    plan: "07-02"
    task: 5
    description: "MermaidBlock.tsx code block contains 4 hex literals (#F2EBFA, #1F1B2E, #6B46C1, #9C95A8) but acceptance criteria forbid hex literals; remediation (Option A: getMermaidThemeVariables() reading from getComputedStyle) appears AFTER the literal code block"
    fix_hint: "Executor must implement Option A directly; tokenSourceOfTruth.test.ts will catch hex leaks at verify time."

  - dimension: task_completeness
    severity: flag
    plan: "07-02"
    task: 2
    description: "Acceptance regex for shadcn-token detection (! grep -qE '(bg|text|border)-(background|foreground|primary|secondary|destructive|muted|accent|card)\\b') has documented false positives — matches dashboard tokens like 'bg-card-bg', 'text-text-primary'"
    fix_hint: "Trust the visual-inspect step ('grep -oE … | sort -u, inspect output is all tokens.css names') as canonical; the negative grep is suggestive only."

  - dimension: verification_derivation
    severity: flag
    plan: "07-VALIDATION.md"
    description: "Sign-off line 123 claims '38 task rows filled' but plans contain 39 tasks (07-01:8 + 07-02:8 + 07-03:4 + 07-04:7 + 07-05:12)"
    fix_hint: "Update sign-off to '39 task rows filled' or audit the VALIDATION.md per-task table for the missing row."

  - dimension: context_compliance
    severity: info
    plan: "07-05"
    task: 6
    description: "impeccable.yml /help addition is a no-op — line 86 already has /help in ROUTES env var"
    fix_hint: "Task body anticipates this; no change required. Confirm and skip commit per the task's 'no-op recording' branch."
```

---

## Recommendation

**Commit the 5 plans as-is.** Then during execution, the executor should:

1. Begin with 07-01 (no caveats — straightforward Wave 0 work).
2. For 07-02, when authoring MermaidBlock.tsx, skip directly to Option A (the `getMermaidThemeVariables()` function). Do not commit hex literals.
3. Run 07-02 and 07-03 in parallel (or concurrent executors). They are disjoint.
4. When executing 07-05-T1, update the snapshot expectations to match the actual helpRouteTable (32 stubs / 44 total — F-05). This will be visible immediately as a snapshot test mismatch on first run; the executor can update it inline.
5. When executing 07-05-T6, confirm `/help` is already in impeccable.yml and skip the commit.
6. Coordinate with the user for the 4 blocking checkpoints in 07-05 (T9-T12).

The plans deliver every ROADMAP success criterion with a clear evidence trail. The flags are surface-level — discoverable at the first failing test and fixable inline. None block commit-as-is.
