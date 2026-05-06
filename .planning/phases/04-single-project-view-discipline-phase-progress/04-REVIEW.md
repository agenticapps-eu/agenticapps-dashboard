---
phase: 04-single-project-view-discipline-phase-progress
reviewed: 2026-05-06T11:30:00Z
depth: standard
files_reviewed: 56
files_reviewed_list:
  - packages/agent/src/lib/__fixtures__/phase4-fixture.ts
  - packages/agent/src/lib/phaseCache.test.ts
  - packages/agent/src/lib/phaseCache.ts
  - packages/agent/src/lib/phaseDetail.test.ts
  - packages/agent/src/lib/phaseDetail.ts
  - packages/agent/src/routes/commitment.ts
  - packages/agent/src/routes/discipline.ts
  - packages/agent/src/routes/observations.ts
  - packages/agent/src/routes/phaseProgress.ts
  - packages/agent/src/routes/security.ts
  - packages/agent/src/server/__tests__/commitment.test.ts
  - packages/agent/src/server/__tests__/discipline.test.ts
  - packages/agent/src/server/__tests__/observations.test.ts
  - packages/agent/src/server/__tests__/phaseProgress.test.ts
  - packages/agent/src/server/__tests__/security.test.ts
  - packages/shared/src/schemas/commitment.test.ts
  - packages/shared/src/schemas/commitment.ts
  - packages/shared/src/schemas/discipline.test.ts
  - packages/shared/src/schemas/discipline.ts
  - packages/shared/src/schemas/observations.test.ts
  - packages/shared/src/schemas/observations.ts
  - packages/shared/src/schemas/phaseDetail.test.ts
  - packages/shared/src/schemas/phaseDetail.ts
  - packages/shared/src/schemas/security.test.ts
  - packages/shared/src/schemas/security.ts
  - packages/spa/src/__tests__/projects-detail-e2e.test.tsx
  - packages/spa/src/components/panels/CommitmentBlock.test.tsx
  - packages/spa/src/components/panels/CommitmentBlock.tsx
  - packages/spa/src/components/panels/ExecutionTimeline.test.tsx
  - packages/spa/src/components/panels/ExecutionTimeline.tsx
  - packages/spa/src/components/panels/HookFirings.test.tsx
  - packages/spa/src/components/panels/HookFirings.tsx
  - packages/spa/src/components/panels/InlineDrift.test.tsx
  - packages/spa/src/components/panels/InlineDrift.tsx
  - packages/spa/src/components/panels/PanelContainer.test.tsx
  - packages/spa/src/components/panels/PanelContainer.tsx
  - packages/spa/src/components/panels/PhaseProgress.test.tsx
  - packages/spa/src/components/panels/PhaseProgress.tsx
  - packages/spa/src/components/panels/RationalizationFires.test.tsx
  - packages/spa/src/components/panels/RationalizationFires.tsx
  - packages/spa/src/components/panels/ReviewStatus.test.tsx
  - packages/spa/src/components/panels/ReviewStatus.tsx
  - packages/spa/src/components/panels/SecurityStatus.test.tsx
  - packages/spa/src/components/panels/SecurityStatus.tsx
  - packages/spa/src/components/panels/VerificationStatus.test.tsx
  - packages/spa/src/components/panels/VerificationStatus.tsx
  - packages/spa/src/components/ProjectHeader.test.tsx
  - packages/spa/src/components/ProjectHeader.tsx
  - packages/spa/src/components/ProjectLayout.test.tsx
  - packages/spa/src/components/ProjectLayout.tsx
  - packages/spa/src/components/SingleProjectView.test.tsx
  - packages/spa/src/components/SingleProjectView.tsx
  - packages/spa/src/lib/projectQueries.test.ts
  - packages/spa/src/lib/projectQueries.ts
  - packages/spa/src/lib/relativeTime.test.ts
  - packages/spa/src/lib/relativeTime.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-06T11:30:00Z
**Depth:** standard
**Files Reviewed:** 56
**Status:** issues_found

## Summary

Phase 4 delivers the single-project detail view with 8 panels across two columns (Discipline left, Phase Progress center). The implementation is structurally sound and correctly observes the hard architectural constraints: all five new daemon routes mount under the bearer-token middleware, all filesystem reads are read-only with no writes to project directories, all schemas are single-sourced from `packages/shared`, and outbound schema validation with `outbound()` is applied on every route. The 5s daemon memo cache (`phaseCache`) is correctly isolated from the Phase 3 `overviewCache` and eviction on unregister is properly wired.

Three warnings were found — none are security issues or data-loss risks, but each represents a latent correctness bug or test-reliability concern. Four info items are minor quality observations.

No hard architectural constraint violations were found.

---

## Warnings

### WR-01: Orphaned SUMMARY files silently omitted from phase checklist

**File:** `packages/agent/src/lib/phaseDetail.ts:258-262`

**Issue:** `parsePhaseChecklist` builds `planPairOrder` by iterating `plans` and then looking for a matching `*-SUMMARY.md`. If a `NN-NN-SUMMARY.md` exists without a paired `NN-NN-PLAN.md` (e.g. a plan file was accidentally deleted after work completed), the summary is silently dropped from the checklist. The PhaseProgress panel will show no row for it, giving users the impression the work was never done.

The test `PC3` covers the inverse case (plan with no summary) correctly, but the orphan-summary scenario is untested and unaddressed.

**Fix:** After building `planPairOrder`, append any summaries not already included:

```typescript
// After the existing plan loop:
for (const summary of summaries) {
  if (!planPairOrder.includes(summary)) planPairOrder.push(summary)
}
```

Or alternatively note this as intentional in a code comment if orphan summaries should be suppressed.

---

### WR-02: `parseRationalizationRows` fire counter uses full-JSON-blob substring match, risking false positives

**File:** `packages/agent/src/lib/phaseDetail.ts:211-215`

**Issue:** The fire-counting loop serializes the entire `HookFiring` entry to JSON and checks whether the label string appears anywhere in the blob:

```typescript
const blob = JSON.stringify(e)
if (blob.includes(label)) fires++
```

A label like `"Row label two"` will match if it appears in ANY field of the entry — including `skill`, `hook`, or even an unrelated `payload` field that happens to contain the label as a substring. For example a hook event from a skill named `"No review needed"` (matching a rationalization row) would falsely increment the fire count even if the event was unrelated to a rationalization detection.

D-4-07 says the counter should aggregate events "whose `payload.row` (or equivalent field) matches a label". The current implementation does not restrict the match to the payload field.

**Fix:** Match against `e.payload` specifically when it is a string, or against a structured field, rather than the full serialized blob:

```typescript
// Replace the blob approach with a targeted payload match:
for (const e of entries) {
  const payload = e.payload
  const matches =
    (typeof payload === 'string' && payload.includes(label)) ||
    (typeof payload === 'object' &&
      payload !== null &&
      Object.values(payload as Record<string, unknown>).some(
        (v) => typeof v === 'string' && v.includes(label),
      ))
  if (matches) fires++
}
```

Note: this is a behaviour change that would break test `R2` unless the test fixture also uses `payload`. The test fixture already sets `payload: 'Row label two'` — so correcting the implementation to inspect `payload` first and then fall back to full-blob only if payload is absent would keep test `R2` passing while reducing false positives. The test `R2` was designed with the correct intent; the implementation strayed from it.

---

### WR-03: Test description for `O3` contradicts assertion — `entries` are populated when skill is absent

**File:** `packages/agent/src/lib/phaseDetail.test.ts:179-191`

**Issue:** The test is titled `"O3: without meta-observer skill returns entries:[], skillInstalled:false"`, but the assertion at line 188 is `expect(result.entries).toHaveLength(1)`. The title and the assertion directly contradict each other.

More importantly, D-4-15 from the CONTEXT specifies: `"Detection: daemon's observations/recent returns { entries: [], skillInstalled: false }"` — the spec intends that when the skill is absent the entries array is empty. The implementation does NOT honour this: it reads and returns JSONL entries regardless of whether `skillInstalled` is true or false.

In the SPA the `HookFirings` panel renders the install-hint and ignores `entries` when `skillInstalled` is false, so the discrepancy has no visible UI effect today. However if a future panel or consumer relies on the `entries` being empty when `skillInstalled: false`, it will be surprised.

**Fix — two options:**

Option A (match spec precisely): When `skillInstalled` is false, return `{ entries: [], skillInstalled: false }` and update the test assertion to `toHaveLength(0)` and rename the test to match. If the intent is to return an empty array, fix the implementation in `readSkillObservations`:

```typescript
if (!skillInstalled) return { entries: [], skillInstalled }
```

(Note: this early return must come before the JSONL read loop, not at the top of the function.)

Option B (document as intentional): Rename the test to `"O3: without meta-observer skill, skillInstalled:false but JSONL still read"` and update the CONTEXT note for D-4-15 to reflect the actual behaviour. This acknowledges the SPA renders the install-hint when `skillInstalled: false` regardless of `entries` content.

---

## Info

### IN-01: `readSkillObservations` sorts timestamps lexicographically — mixed `Z` / `+00:00` ISO formats will sort incorrectly

**File:** `packages/agent/src/lib/phaseDetail.ts:162`

**Issue:** The sort comparator `b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0` is a lexicographic string comparison. ISO 8601 timestamps are lexicographically sortable only when they share the same format. A timestamp like `2026-05-01T10:00:00+00:00` and `2026-05-01T10:00:00Z` represent the same instant but compare differently (`Z` has ASCII 90 vs `+` which is ASCII 43, so `Z` sorts after `+`). A future version of the meta-observer skill that emits `+00:00` offsets instead of `Z` would interleave with `Z` entries incorrectly.

This is low risk in practice (meta-observer output format is consistent), but worth noting if the daemon will ever read JSONL from third-party hooks.

**Fix (optional):** Use Date-object comparison for correctness:

```typescript
all.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
```

---

### IN-02: `phaseProgress.ts` review file detection uses `endsWith('-REVIEW.md')` which would also match a hypothetical `*-IMPECCABLE-REVIEW.md` file

**File:** `packages/agent/src/routes/phaseProgress.ts:79-81`

**Issue:** The review file filter `f.endsWith('-REVIEW.md') && !f.endsWith('-REVIEW-FIX.md')` is correct for the current file naming convention (only `NN-REVIEW.md` and `NN-REVIEW-FIX.md` exist). However if a future gsd tool creates a file named e.g. `04-IMPECCABLE-REVIEW.md`, it would be incorrectly classified as the Stage 1 review file, potentially overwriting a real `04-REVIEW.md` result with the impeccable data.

This is a naming-convention dependency. Current Phase 3 artifacts confirm IMPECCABLE files are named `03-IMPECCABLE.md` (not ending in `-REVIEW.md`), so there is no active bug. Recording as info for robustness.

**Fix (optional):** Narrow the pattern to match only the expected exact suffix `NN-REVIEW.md`:

```typescript
const reviewFile = dirFiles.find(
  (f) => /\d{2}-REVIEW\.md$/.test(f) && !/\d{2}-REVIEW-FIX\.md$/.test(f),
)
```

---

### IN-03: Test comment mismatch in `observations.test.ts` X7 — test asserts `entries` is an array but doesn't validate it is empty

**File:** `packages/agent/src/server/__tests__/observations.test.ts:188-212`

**Issue:** Test X7 verifies the `skillInstalled: false` case for a project with no meta-observer skill. The assertion correctly checks `skillInstalled` is false and that `entries` is an array, but it does not assert that `entries` is empty. If the route returned a populated entries array (which it would for a project with JSONL but no skill — per WR-03), this test would still pass. The test under-specifies the shape.

**Fix:** Add `expect(data.entries).toHaveLength(0)` to pin the expected empty-entries contract (or decide to fix the implementation per WR-03 Option A first, then make this assertion accurate).

---

### IN-04: `SingleProjectView.tsx` is missing a `React` import at the module level

**File:** `packages/spa/src/components/SingleProjectView.tsx`

**Issue:** The component uses `React.JSX.Element` as its return type annotation on line 26 but has no `import React from 'react'` at the top. The file only imports `{ useEffect }` from `'react'`. With modern JSX transform (`"jsx": "react-jsx"` in tsconfig) a bare `React` import is not needed for JSX transpilation, but the explicit `React.JSX.Element` type reference in the function signature does require `React` to be in scope.

Whether this is a bug or just a style inconsistency depends on the tsconfig `jsx` and `jsxImportSource` settings. If the project uses `"jsxImportSource": "react"` (Vite default for React 18), then `JSX.Element` from the implicit import would suffice, but `React.JSX.Element` requires the namespace. Other panel components (e.g. `CommitmentBlock.tsx`, `HookFirings.tsx`) all have `import React from 'react'` explicitly. Check whether `pnpm -r typecheck` passes; if it does, this is a style inconsistency rather than a bug.

**Fix:** Add `import React from 'react'` at line 12, consistent with all sibling panel components.

---

_Reviewed: 2026-05-06T11:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
