---
phase: DASH-12-observability-conformance-surface
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - packages/agent/src/lib/conformanceCache.ts
  - packages/agent/src/lib/conformanceScan.ts
  - packages/agent/src/lib/conformanceScore.ts
  - packages/agent/src/lib/conformanceScore.test.ts
  - packages/agent/src/lib/registryPathDrift.ts
  - packages/agent/src/lib/snapshots/snapshotFleetReader.ts
  - packages/agent/src/lib/snapshots/snapshotFleetReader.test.ts
  - packages/agent/src/lib/snapshots/snapshotPaths.ts
  - packages/agent/src/lib/snapshots/snapshotPaths.test.ts
  - packages/agent/src/routes/conformance.ts
  - packages/agent/src/routes/registryFixPath.ts
  - packages/agent/src/server/app.ts
  - packages/shared/src/schemas/conformance.ts
  - packages/shared/src/schemas/conformance.test.ts
  - packages/shared/src/index.ts
  - packages/spa/src/components/panels/conformance/ConformancePage.tsx
  - packages/spa/src/components/panels/conformance/FleetTrendChart.tsx
  - packages/spa/src/components/panels/conformance/PathDriftPanel.tsx
  - packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx
  - packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx
  - packages/spa/src/components/panels/coverage/CoverageFamilySectionMobile.tsx
  - packages/spa/src/components/panels/coverage/CoverageFamilySectionMobile.test.tsx
  - packages/spa/src/lib/conformanceQueries.ts
  - packages/spa/src/lib/useViewportBreakpoint.ts
  - packages/spa/src/lib/useViewportBreakpoint.test.ts
  - packages/spa/src/routes/observability.conformance.lazy.tsx
  - packages/spa/src/vitest.setup.ts
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-10
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Retrospective close-out review of the Phase 12 observability conformance surface. The hard
architectural constraints hold up: the `fix-path` write surface is genuinely read-only on
project filesystems (it mutates only `~/.agenticapps/dashboard/registry.json` via
`atomicWriteFile` at mode `0o600` under an `O_EXCL` cross-process lock), the path-validation
pipeline is layered and defensible (blocklist-on-resolve → realpath → blocklist-on-realpath →
family-root containment → is-a-repo → origin-match), `registryPathDrift.ts` parses `.git/config`
with `fs.readFile` + regex and never spawns a subprocess, and error responses are structured
error-code-only with no FS-path echo. No Critical findings.

However, the write surface and the orchestrator carry several correctness and robustness defects
that should be fixed: the family-root containment check is bypassable on macOS via the canonical
`/tmp` symlink interaction with `COVERAGE_ROOTS` (WR-01), the daemon computes a `partialFailures`
signal that the SPA never surfaces — so a crashed sub-scan renders as healthy zeros (WR-02), the
`Retry-After` header lies about the real backoff window (WR-03), and the SVG trend chart adds up
to 90 sequential tab stops inside a `role="img"` container with no roving-tabindex (WR-04). The
remaining findings are robustness/quality nits.

## Warnings

### WR-01: Family-root containment can be bypassed when a registered family root resolves through a symlink that the realpath comparison does not re-anchor

**File:** `packages/agent/src/routes/registryFixPath.ts:172-184`, cross-ref `packages/agent/src/lib/registryPathDrift.ts:213-215`
**Issue:**
The containment check in `fix-path` (step 5) is strict: `canonical.startsWith(r + sep)` where
each `r` is the *realpath* of a `COVERAGE_ROOTS` family dir. That is correct for `fix-path`.
But the parallel containment logic in `registryPathDrift.ts:probeEntry` (the `git-remote-changed`
classifier) and in `conformanceScan.ts:pathToRepoId` use **different** anchoring rules:
`probeEntry` allows `canonical === root` (line 214) while `fix-path` deliberately forbids
`canonical === r` (only `startsWith(r + sep)`). The two modules disagree on whether a registry
entry *equal to* a family root is "inside the family". This is not merely cosmetic: a registry
entry pointing exactly at `~/Sourcecode/agenticapps` is treated as **not drifted** by the drift
detector (so it is never surfaced for repair and never excluded from scoring), yet `fix-path`
would reject any attempt to set that same value. The result is a registry state that the drift
panel calls healthy but the write surface calls illegal — a self-inconsistent invariant across
the read and write halves of the same feature.
**Fix:** Pick one containment predicate and share it. Export a single
`isInsideFamilyRoot(canonical, roots)` helper (mirroring `pathEqualsOrIsUnder` in registry.ts)
and have `probeEntry`, `pathToRepoId`, and the `fix-path` step-5 check all call it. If a family
root itself must never be a valid project root (the `fix-path` stance, justified in the comment
at line 174), then `probeEntry` should classify `canonical === root` as drift, not as healthy.

### WR-02: `partialFailures` is computed by the daemon and validated on the wire but never consumed by the SPA — crashed sub-scans render as healthy zeros

**File:** `packages/spa/src/components/panels/conformance/ConformancePage.tsx:104-200`, cross-ref `packages/agent/src/lib/conformanceScan.ts:131-247` and `packages/shared/src/schemas/conformance.ts:122-132`
**Issue:**
`scanConformance` goes to real trouble to push `'coverage' | 'drift' | 'series'` onto
`partialFailures` precisely so the SPA "can surface a banner" (schema comment, conformance.ts:122-132;
scan comment, conformanceScan.ts:131-135). `ConformancePage` never reads `data.partialFailures`.
A coverage-scan crash therefore produces `today: {fleet:0, ...}` and an empty drift/series set
that is rendered **identically to a genuinely 0%-conformant fleet** — and then cached for 30s.
This is exactly the "silent debugging nightmare" the daemon comment claims to have fixed; the fix
was only completed on the daemon half. The feature's own stated intent is unmet.
**Fix:** In `ConformancePage`, after the happy-path narrowing, render a non-leaky banner when
`data.partialFailures?.length`:
```tsx
{data.partialFailures && data.partialFailures.length > 0 && (
  <div role="status" className="rounded-lg border border-status-warning bg-card-bg p-3 text-sm text-status-warning">
    Some conformance data could not be loaded ({data.partialFailures.join(', ')}). Scores may be incomplete.
  </div>
)}
```
The codes (`coverage`/`drift`/`series`) are fixed internal tokens, not FS paths, so surfacing
them does not violate T-12-PAGE-ERROR-LEAK.

### WR-03: `Retry-After` header advertises 1 second but the rate-limit window is 10 seconds

**File:** `packages/agent/src/routes/registryFixPath.ts:112-118`, cross-ref `packages/agent/src/lib/rateLimiter.ts:24-37`
**Issue:**
`rlConsume` returns a hardcoded `retryAfter: 1` regardless of the actual window
(`WINDOW_MS = 10_000`). The route faithfully relays that into `'Retry-After': '1'`. A well-behaved
client (or the SPA's own toast copy "try again in a few seconds") that honors `Retry-After: 1`
will retry after one second and be rejected again, because the sliding window only frees a slot
once a 10-second-old timestamp ages out. The header is actively misleading and defeats the
purpose of returning it.
**Fix:** Compute the real backoff in `consume`: when over `BURST_CAP`, `retryAfter` should be
`Math.ceil((recent[0] + WINDOW_MS - now) / 1000)` (seconds until the oldest in-window timestamp
expires), not a constant `1`.

### WR-04: FleetTrendChart creates up to 90 sequential tab stops inside a `role="img"` container with no roving-tabindex and no arrow-key navigation

**File:** `packages/spa/src/components/panels/conformance/FleetTrendChart.tsx:50-95`
**Issue:**
Every day in the series renders an invisible `<rect tabIndex={0}>` (line 83). At steady state
(90 days) a keyboard user must press Tab 90 times to traverse the chart and exit, and these
focusable elements are children of a `role="img"` element — which is a contradiction: `img` is a
leaf/atomic role and its subtree is expected to be presentational. Screen readers that honor the
`img` role may not expose the per-rect `aria-label`s at all (the `<table className="sr-only">` is
the real accessibility affordance), so the 90 tab stops add keyboard burden without a reliable AT
benefit. The `onKeyDown` handler only intercepts `Escape`; there is no arrow-key movement between
points, so the tabindex is doing navigation work it is not equipped for.
**Fix:** Implement a roving tabindex — only the active point is `tabIndex={0}`, the rest are
`tabIndex={-1}`, and ArrowLeft/ArrowRight move `hoverIdx`. Drop `role="img"` from the wrapping
`<div>` (or move the focusable layer out of the img subtree) so the focusable rects are not
nested under an atomic role. The `sr-only` table already covers AT users, so the rects can serve
sighted-keyboard hover only.

### WR-05: `fix-path` performs the realpath + blocklist + family-root checks OUTSIDE the registry lock, leaving a TOCTOU window between validation and the is-a-repo / write steps

**File:** `packages/agent/src/routes/registryFixPath.ts:143-228`
**Issue:**
`realpath(body.newPath)` (line 150), the blocklist re-check (line 161), and the family-root
containment (lines 177-184) all run *before* `withRegistryLock` is acquired (line 204). Only the
project lookup, the is-a-repo check, the origin check, and the write happen inside the lock.
Between the realpath at line 150 and the `existsSync(join(canonical, '.git'))` at line 214, an
attacker with same-uid filesystem access (the threat model that motivates `O_NOFOLLOW`) can swap
`canonical` from a benign repo to a symlink/dir of their choosing — the canonical string is
already fixed, but what it *points at* on disk when `.git` is probed and when later reads resolve
is re-evaluated. The realpath result is trusted as immutable for the rest of the handler. This is
a narrower window than a full traversal, but the whole point of the layered checks is defeated if
the validated target can be mutated before use.
**Fix:** Re-realpath `canonical` *inside* the lock immediately before the is-a-repo check and
re-run `assertRegistrationAllowed` + containment on that fresh result, or accept the residual risk
explicitly in a code comment with the same-uid-already-game-over rationale. At minimum the
defense-in-depth claim in the header comment (lines 22-34) should not imply the checks are
atomic with the write when they are not.

### WR-06: `delta14d` schema accepts unbounded signed integers despite the documented -100..+100 contract, and `scanConformance` can emit values outside that range

**File:** `packages/shared/src/schemas/conformance.ts:112-119`, cross-ref `packages/agent/src/lib/conformanceScan.ts:229-236`
**Issue:**
The schema declares `delta14d.fleet: z.number().int()` with a comment "signed delta in score
points (-100..+100)" but no `.min(-100).max(100)` refinement, whereas every other score field
uses the bounded `ScoreSchema`. The computed deltas (`today.fleet - baseline.fleet`) are always
in `[-100, 100]` given both operands are `[0,100]`, so this is not currently violated — but the
asymmetry means a future bug that produces an out-of-range delta would pass the outbound schema
guard silently, defeating the INV-04 "schema drift surfaces at the boundary" invariant that the
rest of this file relies on. The wire contract should encode the documented bound.
**Fix:** `fleet: z.number().int().min(-100).max(100)` (and same for the three family fields), so
the outbound `parse` in `conformance.ts` actually enforces the range the comment promises.

## Info

### IN-01: Duplicated score formula across two modules with only a comment guarding the contract

**File:** `packages/agent/src/lib/conformanceScore.ts:53-70` and `packages/agent/src/lib/snapshots/snapshotFleetReader.ts:105-117`
**Issue:** `scoreRows` (typed CoverageRow) and `scoreFamilyRecords` (raw NDJSON) implement the
same green/total/Math.round formula and the same Pitfall-2 exclusion, kept in sync only by file
comments. A change to one (e.g. adding a 5th column like `understand`, which already exists on
CoverageRow and is scored in coverage's worst-state-wins) silently diverges the "Today" card from
the trend chart's rightmost point.
**Fix:** Extract a shared `scoreCells(states: Iterable<string>): {green; total; score}` primitive
both call, or add a test that asserts the two paths agree on a shared fixture.

### IN-02: `understand` column is scored in CoverageFamilySection worst-state but is absent from conformance scoring

**File:** `packages/agent/src/lib/conformanceScore.ts:59` vs `packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx:92-104`
**Issue:** `worstState` includes `row.understand` when present, but `scoreRows`/`scoreFamilyRecords`
hardcode only the 4 original columns. The conformance score and the coverage worst-state-wins
aggregate now count different column sets. Likely intentional (Phase 14 added `understand` after
Phase 12 froze the score formula), but undocumented in the score file.
**Fix:** Add a one-line comment in `conformanceScore.ts` stating that `understand` is deliberately
excluded from the conformance score, or align the two.

### IN-03: `realFamilyRoots()` in fix-path and `realFamilyRoot()` in registryPathDrift duplicate identical realpath-tolerant logic

**File:** `packages/agent/src/routes/registryFixPath.ts:82-92` and `packages/agent/src/lib/registryPathDrift.ts:106-112`
**Issue:** Two copies of "realpath a COVERAGE_ROOTS family dir, return null on throw". Related to
WR-01 — sharing the helper would also force the containment predicates to converge.
**Fix:** Hoist a single exported `realFamilyRoots()` into `paths.ts` or a small shared helper.

### IN-04: `FAMILY_ROOTS` / `SCANNED_FAMILIES` / `FAMILY_KEYS` / `FAMILIES` — the same three-family tuple is re-declared in at least five files

**File:** `registryFixPath.ts:75`, `registryPathDrift.ts:49`, `conformanceScan.ts:51`, `snapshotFleetReader.ts:62`, `ConformancePage.tsx:38`, `FleetTrendChart.tsx:20`
**Issue:** The canonical family list is duplicated as a literal in six locations. A fourth family
(or a rename) requires touching all six and is easy to miss. `COVERAGE_ROOTS` already enumerates
them; a derived `const FAMILIES = Object.keys(...)` style single source would prevent drift.
**Fix:** Export one `CONFORMANCE_FAMILIES` tuple from shared (or paths.ts) and import it.

### IN-05: Magic ISO-day arithmetic (`14 * 24 * 60 * 60 * 1000`) repeated inline

**File:** `packages/agent/src/lib/conformanceScan.ts:219`, `packages/agent/src/lib/snapshots/snapshotFleetReader.ts:140`
**Issue:** The day-in-ms constant is open-coded in both the delta-14d window and the snapshot
cutoff. Two chances to fat-finger a zero.
**Fix:** `const MS_PER_DAY = 86_400_000` (or a named `DAY_MS`) shared once.

### IN-06: `FleetTrendChart` renders duplicate 70/90 threshold lines

**File:** `packages/spa/src/components/panels/conformance/FleetTrendChart.tsx:52-67`
**Issue:** The gridline loop computes `isThreshold = v === 70 || v === 90` (line 53) but the base
gridline set is `[0,25,50,75,100]` — neither 70 nor 90 is in it, so `isThreshold` is always false
and that branch is dead. The actual 70/90 rules are drawn by the separate `[70,90].map` block
(lines 64-67). The dead `isThreshold` computation and its `strokeDasharray` spread are misleading
leftover code.
**Fix:** Remove the `isThreshold` variable and its conditional spread from the first loop; keep
only the dedicated threshold-rule block.

### IN-07: `PathDriftPanel` manual-path input has no client-side path validation before POST

**File:** `packages/spa/src/components/panels/conformance/PathDriftPanel.tsx:175-186, 99-101`
**Issue:** The manual-paste path is sent verbatim to the daemon (which validates thoroughly), so
this is not a security gap — but a user pasting an obviously-relative or empty-after-trim string
gets a round-trip + generic toast rather than inline feedback. `newPath` is only guarded by
`maxLength` and a truthiness check; a whitespace-only string passes the `!newPath` guard and the
`.min(1)` Zod check, then fails deeper with a less helpful code.
**Fix:** Trim and reject empty/whitespace client-side before `mutateAsync`, and optionally hint
that an absolute path under a family root is expected.

---

_Reviewed: 2026-06-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
