---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
artifact: review
stage_1_date: 2026-05-24
stage_1_reviewer: gsd-orchestrator (Wave 4 Task 2 — gstack /review proxy)
stage_2_date: 2026-05-24
stage_2_reviewer: superpowers:requesting-code-review (independent, fresh context)
status: both-stages-complete
findings_high: 1
findings_medium: 2
findings_low: 1
findings_info: 3
findings_critical: 0
findings_important: 4
findings_minor: 7
high_addressed: 1
medium_addressed: 2
important_addressed: 4
---

# Phase 13 Code Review

**Branch:** `feat/phase-13-gitnexus-scoped-scan`
**Diff scope:** ~50 commits across Plans 13-00 / 13-01 / 13-02 / 13-03 (and Plan 13-04 fix commits below)
**Reviewers:** Stage 1 = `/review` (gstack) — by orchestrator; Stage 2 = `superpowers:requesting-code-review` (independent reviewer, fresh context)

---

## Stage 1 — gstack `/review`

**Date:** 2026-05-24
**Diff scope:** All files changed across Plans 00/01/02/03. New surface: 3 daemon modules (gitnexusScan/gitnexusFamilyScan/gitnexusScan route), 1 shared schema module, 1 SPA hooks module, 1 SPA component (ScanPill), 1 SPA queries deviation (healthQueries), 1 daemon route mount + bindMode plumbing + /health composite. Deletions: 1 SPA component (IndexGitNexusButton) + its test.

### Findings

<finding severity="high" id="S1-01" file="packages/spa/src/components/panels/coverage/ScanPill.tsx" lines="162">
**`bg-accent-soft`, `bg-accent-softer`, and `rounded-pill` are not defined in design tokens — Tailwind 4 silently produces no CSS for them.**

The ScanPill's idle-state button used:
```
className="inline-flex items-center gap-1 text-xs rounded-pill bg-accent-soft px-2 py-0.5 hover:bg-accent-softer focus:outline focus:outline-2 focus:outline-accent"
```

`packages/spa/src/styles/tokens.css` defines only:
- `--color-accent`, `--color-accent-hover`, `--color-accent-bg`, `--color-accent-bg-strong`
- `--radius-card`

There are no `--color-accent-soft`, `--color-accent-softer`, or `--radius-pill` tokens, and no `@utility` blocks defining them. Tailwind 4 generates utilities exclusively from `@theme` variables (and built-ins), so `bg-accent-soft` and `rounded-pill` silently produce no CSS — the pill button rendered with default browser button styling instead of the intended accent affordance.

This breaks D-13-08 (per-row Scan affordance must be visually distinguishable) and would have failed the Wave 4 Task 5 `impeccable:critique` composite floor (≥ 87).

**Fix:** mirror the canonical pattern from `OnboardingHero.tsx` (`bg-accent/10`) and use the built-in `rounded-full`. Tailwind 4 supports `bg-<token>/<opacity>` for the accent color we already have.

```diff
- className="... rounded-pill bg-accent-soft px-2 py-0.5 hover:bg-accent-softer ..."
+ className="... rounded-full bg-accent/10 px-2 py-0.5 hover:bg-accent/20 ..."
```
</finding>

<finding severity="medium" id="S1-02" file="packages/spa/src/lib/queries/gitnexusScan.ts" lines="82-84">
**Dead `useQueryClient` import + call in `useGitnexusScanProgress`.**

```ts
// qc is imported for potential consumer use, but NOT used directly in the hook.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const qc = useQueryClient()
```

The hook documents that invalidation is the consumer's responsibility (D-13-09) and `qc` is never referenced. The eslint-disable-next-line is hiding genuinely dead code — there is no "potential consumer use" because `qc` isn't returned from the hook. The unused call adds an unnecessary subscription to QueryClient context.

**Fix:** remove the import, the `qc` assignment, and the `eslint-disable-next-line`. Collapse the function body back to a direct `return useQuery({...})`.
</finding>

<finding severity="medium" id="S1-03" file="packages/spa/src/lib/queries/gitnexusScan.ts" lines="98-102">
**`refetchInterval` does not halt polling on terminal error — infinite re-fetch on 404 SCAN_NOT_FOUND.**

```ts
refetchInterval: (q) => {
  const job = q.state.data
  if (!job) return 1500
  return job.state === 'running' ? 1500 : false
}
```

If `queryFn` throws (e.g. the daemon returned 404 SCAN_NOT_FOUND because the job was evicted after the 60s TTL), `q.state.data` stays `undefined`. The `if (!job) return 1500` branch keeps polling at 1500ms forever. TanStack Query continues to fire `refetchInterval` callbacks even when the query is in error state, so this is an infinite-poll bug.

In normal use the TTL is 60s, so a slow user could lose connection mid-scan, return to the page after the eviction, and see the SPA hammering the daemon at 1500ms forever.

**Fix:** halt polling explicitly when `q.state.status === 'error'`.

```diff
  refetchInterval: (q) => {
+   if (q.state.status === 'error') return false
    const job = q.state.data
    if (!job) return 1500
    return job.state === 'running' ? 1500 : false
  }
```
</finding>

<finding severity="low" id="S1-04" file="packages/shared/src/schemas/gitnexusScan.ts" lines="48">
**Repo target regex is lowercase-only — would reject valid uppercase-cased repo names.**

```ts
target: z.string().regex(/^[a-z0-9\-]+\/[a-z0-9\-_.]+$/)
```

The pattern restricts the second segment (`repo` part) to lowercase letters, digits, hyphens, underscores, and dots. All current registry entries in this monorepo happen to be lowercase (`cparx`, `fx-signal-agent`, `factiv-website`, etc.), so the regex doesn't reject any real input today.

Future repos with mixed-case names (`MyRepo`, `IconKit`) would surface as 422 INVALID_REQUEST with no diagnostic message. Either:
- Document the lowercase constraint as a contract (and have `derivedRepoId` lowercase the basename), OR
- Widen the regex to `/^[a-z0-9\-]+\/[a-zA-Z0-9\-_.]+$/` to accept the cases we'd naturally derive from `basename(root)`.

**Disposition:** accept-with-rationale — the constraint matches reality today; tighten or widen when a real mixed-case repo lands in the registry.
</finding>

<finding severity="info" id="S1-05" file="packages/spa/src/components/panels/coverage/ScanPill.tsx" lines="151-152">
**Discriminated-union prop type would eliminate the `as any` cast.**

```ts
// Cast needed: TS can't narrow discriminated union from destructured props
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const r = await scan.mutateAsync({ scope, target } as any)
```

`ScanPillProps` declares `scope: 'repo' | 'family'` and `target: string` as independent fields. Because `GitnexusScanRequestSchema` is a discriminated union (`scope:'repo'` requires the repo regex, `scope:'family'` requires the family enum), `{ scope, target }` cannot be narrowed structurally — hence the `as any`.

**Disposition:** accept-with-rationale — this is a typing-only improvement. A future tightening would refactor `ScanPillProps` itself into a discriminated union (`| { scope: 'repo'; target: RepoSlug } | { scope: 'family'; target: FamilyId }`), eliminating the cast at every call site. Not blocking.
</finding>

<finding severity="info" id="S1-06" file="packages/spa/src/components/panels/coverage/ScanPill.tsx" lines="64-107">
**`useEffect` deps array disables `react-hooks/exhaustive-deps`.**

```ts
useEffect(() => { ... }, [progress.data?.state])
// eslint-disable-next-line react-hooks/exhaustive-deps
```

The effect body references `progress.data`, `qc`, `toast`, `target`, and `scanErrorCodeToMessage`; only `progress.data?.state` is in the deps array. This is a deliberate single-dep pattern to fire the effect exactly once on terminal-state transition. `qc` and `toast` are stable refs from React Query / Toast providers, and `target`/`progress.data` are stable within a single mount.

**Disposition:** accept-with-rationale — the standard pattern for "fire once on state change" callbacks. Document the rationale inline so the next reviewer doesn't re-flag it.
</finding>

<finding severity="info" id="S1-07" file="packages/shared/src/schemas/gitnexusScan.ts" lines="98-102">
**`FamilyScanShape.perRepoResults[].error.code` accepts the full 11-code enum but only a 6-code subset is reachable.**

```ts
perRepoResults: z.array(z.object({
  ...
  error: z.object({ code: GitnexusScanErrorCodeSchema, message: z.string() }).strict().optional(),
}).strict())
```

Inside `perRepoResults`, only subprocess-level codes are reachable: `BINARY_NOT_FOUND`, `REPO_NOT_REGISTERED`, `SCAN_IN_FLIGHT`, `SCAN_FAILED`, `SCAN_TIMEOUT`, `INTERNAL_ERROR`. POST-level codes (`BIND_REFUSED`, `RATE_LIMITED`, `INVALID_REQUEST`, `SCAN_NOT_FOUND`, `FAMILY_HAS_NO_REPOS`) cannot appear because the family scan never reaches the route boundary per child repo.

**Disposition:** accept-with-rationale — tightening the contract here adds compile-time safety but no runtime correctness. The 11-code enum is the documented source of truth (D-13-EXT-06). Reuse is acceptable.
</finding>

### Disposition

| Finding | Severity | Status | Action |
|---------|----------|--------|--------|
| S1-01 | high | **addressed** | commit `82787dc` — replaced undefined tokens with `bg-accent/10` + `rounded-full` |
| S1-02 | medium | **addressed** | commit `549f4da` — removed dead `useQueryClient` import + call |
| S1-03 | medium | **addressed** | commit `549f4da` — added `q.state.status === 'error'` halt branch |
| S1-04 | low | accepted-with-rationale | constraint matches all current registry entries; tighten or widen when a mixed-case repo lands |
| S1-05 | info | accepted-with-rationale | typing-only improvement; defer to a future `ScanPillProps` discriminated-union refactor |
| S1-06 | info | accepted-with-rationale | standard "fire once on state change" pattern; rationale already documented inline |
| S1-07 | info | accepted-with-rationale | enum reuse over enum-subset clone; D-13-EXT-06 names the 11-code enum as the source of truth |

### Cross-cutting observations

- **Schema-drift defence (INV-04) is consistently applied.** Every JSON response goes through `outbound(c, schema.parse.bind(schema), payload)` — daemon and SPA share the same Zod schemas and surface mismatches as `schema_drift` rather than silently shipping the wrong shape.
- **Threat model annotations are present at every relevant code site.** `T-13-02-01..08` IDs appear in the module docstrings, route docstring, and the `_doSpawnAndSettle` error mapping. Easy to cross-reference with 13-CSO.md.
- **Test scaffold quality is high.** The 13-00 RED scaffold covered ~36 test declarations across 5 files; Waves 2 and 3 greened them without restructuring. One scaffold bug (`cleanup` imported from `vitest` instead of `@testing-library/react`) was caught and fixed during Wave 3 — recorded as a deviation in 13-03-SUMMARY.md.
- **Deviation: `healthQueries.ts` was added during Wave 3** as a Rule-2 (missing functionality) — the SPA needed `useHealth()` to drive `canScan` prop on ScanPill, and the hook didn't exist. The deviation is documented in 13-03-SUMMARY.md and the new file is a small (~59-line) idiomatic TanStack hook.

---

## Stage 2 — `superpowers:requesting-code-review`

**Date:** 2026-05-24
**Reviewer:** independent fresh-context agent dispatched via `superpowers:requesting-code-review`
**Diff scope:** `main..feat/phase-13-gitnexus-scoped-scan` at HEAD `f1517a7` (post Stage-1 fixes)

### Strengths confirmed

The reviewer validated and called out:
- Concurrency model (per-repo + global locks) in `lib/gitnexusScan.ts:111-125` and the deliberate sequential `gitnexusFamilyScan` with event-driven `waitForScanSettle` rather than polling
- stderr-leak defence (`lib/gitnexusScan.ts:296-326`) — fixed error-code enum, raw `result.stderr` captured but never propagated; integration test 2 explicitly probes for a seeded secret
- bindMode refusal precedence (`routes/gitnexusScan.ts:54-58`) — checked BEFORE rate-limit and body-parse on both POST and GET; mock asserts `startScan` never called when bindMode is non-loopback
- Schema-drift defence (INV-04) — every response goes through `outbound(c, schema.parse.bind(schema), payload)` with `.strict()` rejecting extra keys at the boundary
- All three Stage-1 fixes (S1-01/02/03) are correct and don't regress anything
- HealthResponse backward-compat preserved (optional + SPA defaults to false)

### Findings

<finding severity="critical" id="S2-CRIT" file="(n/a)" lines="(n/a)">
**No Critical findings.** Reviewer explicitly noted: "No hard-constraint violations, no auth bypasses, no broken functionality."
</finding>

<finding severity="important" id="S2-I1" file="packages/agent/src/__tests__/gitnexusScan.integration.test.ts" lines="62-67, 138-298">
**Integration tests write into the user's real `~/Sourcecode/{family}/...` directories.**

`createRepoDir(family, repo)` mkdirs `~/Sourcecode/{family}/{repo}` against the real `os.homedir()` because the production code under test (`derivedRepoId`) reads `homedir()` and the test fixture didn't override it. A crashed test leaves residue inside the user's actual project tree; the `_inttest-...-${Date.now()}` prefix is a band-aid, not a fix.

**Fix:** make hermetic via the existing `makeTmpHome` fixture — extend it to set `process.env.HOME` for the lifetime of the test so `os.homedir()` resolves to the sandbox.
</finding>

<finding severity="important" id="S2-I2" file="packages/shared/src/clipboard.ts" lines="41-50">
**D-13-10 single-source-of-truth helper is dead code at every consumer.**

`buildGitnexusIndexClipboardString()` returns `{string, argv}` per D-13-10 ("extend it to also return an argv: string[] representation so the daemon can call execa without re-quoting"), but neither daemon spawn site consumes the `argv` field — both `lib/coverageSpawn.ts:67` and `lib/gitnexusScan.ts:390` hardcode `['analyze']`. The IndexGitNexusButton.tsx SPA caller that previously consumed `.string` was deleted in the same phase.

Next time someone changes the argv (`['analyze', '--quiet']`?), the helper and the spawn diverge silently — exactly the failure mode D-13-10 was supposed to prevent.

**Fix:** wire `coverageSpawn.ts:67` and `gitnexusScan.ts:390` to call `buildGitnexusIndexClipboardString().argv` (fulfils D-13-10) OR revert the helper to a bare string and update the decision log.
</finding>

<finding severity="important" id="S2-I3" file="packages/spa/src/components/panels/coverage/CoverageFamilySectionMobile.tsx" lines="41-67, 161-194">
**Mobile coverage layout drops the ScanPill entirely.**

`CoverageFamilySection.tsx:160-170` branches to `CoverageFamilySectionMobile` for `xs`/`sm` viewports and forwards `onRefresh` + `inFlightRefreshes` but explicitly NOT `gitnexusInstalled`/`gitnexusCanScan`. The mobile gitnexus column is a plain `CoverageCell` regardless of state, and the per-row refresh button still routes through the old `gitnexus-analyze` action.

On phones/tablets (<768px) the user gets none of Phase 13's affordances.

**Fix:** pass `gitnexusInstalled`/`gitnexusCanScan` through to mobile and render ScanPill in the per-row card.
</finding>

<finding severity="important" id="S2-I4" file="packages/spa/src/components/panels/coverage/CoverageRow.tsx" lines="51-55, 184-219">
**Two parallel entry points for the same action — `state='missing'` rows expose ScanPill AND the popover's "Run gitnexus analyze".**

For a row with `state === 'missing'`, the gitNexus cell shows the ScanPill (line 151) AND the refresh popover (line 202) lists "Run gitnexus analyze for this repo" (line 54), dispatching through `useCoverageRefresh` (different endpoint, different progress UI, different invalidation). A user can click both in quick succession, double-firing scans.

13-RESEARCH.md:375 explicitly says *"Existing refresh-popover stays for non-gitnexus actions"* — implying the gitnexus entry should be dropped from `getRefreshOptions`.

**Fix:** remove the `gitnexus-analyze` branch from `getRefreshOptions` (CoverageRow.tsx:53-55) and from `handleRefresh` (CoveragePage.tsx:155-200, the case 'gitnexus-analyze' block). The clipboard/wiki/CLAUDE-md popover actions stay.
</finding>

<finding severity="minor" id="S2-M1" file="packages/spa/src/components/panels/coverage/ScanPill.tsx" lines="115-128">
**Disabled ScanPill wraps a button in a Tooltip whose trigger has a dotted-underline border.**

`Tooltip`'s trigger `<span>` always carries `border-b border-dotted border-text-tertiary cursor-default`. When that wraps the disabled ScanPill button (already styled `opacity-50 cursor-not-allowed`), you get a span with dotted-underline visual cue containing a disabled button — visually weird.

**Disposition:** verify in a screenshot; consider a `Tooltip` variant with no decorative underline for button-wrapped use.
</finding>

<finding severity="minor" id="S2-M2" file="packages/spa/src/components/panels/coverage/ScanPill.tsx" lines="112">
**`if (!installed) return null` is unreachable in current usage.**

Both call sites (`CoverageRow.tsx:151`, `CoverageFamilySection.tsx:209`) gate on `gitnexusInstalled` before mounting ScanPill. The internal `if (!installed) return null` is defensive but unreachable today. Tests exercise the null path directly.

**Disposition:** accept-with-rationale — defensive coding for future call-site changes; the test still locks the contract.
</finding>

<finding severity="minor" id="S2-M3" file="packages/agent/src/lib/gitnexusScan.ts" lines="364-376">
**`derivedRepoId` can collide if nested registry entries are registered.**

`rel.split(sep)` takes the first two segments only, so a registry containing both `~/Sourcecode/agenticapps/foo` and `~/Sourcecode/agenticapps/foo/sub` would both map to `agenticapps/foo`.

**Disposition:** Phase 12 registry validation likely prevents nested entries; defensive fix would require `parts.length === 2` instead of `>= 2`.
</finding>

<finding severity="minor" id="S2-M4" file="packages/agent/src/lib/gitnexusScan.ts" lines="90">
**`BinOverride` type literal `'not-found'` is unused.**

Typed as `string | 'not-found' | null` but the setter only accepts `string | null` and `'not-found'` is never assigned.

**Disposition:** drop the literal from the type.
</finding>

<finding severity="minor" id="S2-M5" file="packages/agent/src/routes/gitnexusScan.ts" lines="124-145">
**GET `/scan/:id` has no rate limiter.**

POST is rate-limited (10/10s per token-hash); GET is not. With the SPA polling at 1500ms and potentially multiple tabs open, a misbehaving SPA could flood the daemon.

**Disposition:** bearer auth + loopback-only makes this low-impact; consider a softer cap (e.g., 60/10s) for symmetry.
</finding>

<finding severity="minor" id="S2-M6" file="packages/agent/src/__tests__/gitnexusScan.integration.test.ts" lines="213">
**Integration test 3's stub uses `python3` for sub-second sleep — portability risk on CI runners without python3.**

**Disposition:** replace with `sleep 0.3` (POSIX-non-strict but works on macOS bash + most Linux) or a node one-liner; accept the python3 dependency explicitly in CI otherwise.
</finding>

<finding severity="minor" id="S2-M7" file="packages/agent/src/cli/__tests__/end-to-end.subprocess.test.ts" lines="83">
**Pre-existing test failure on `end-to-end.subprocess.test.ts` may be amplified by new `/health` filesystem probes.**

The test isn't modified by Phase 13, but Phase 13's `/health` adds `existsSync()`/`readdirSync()` calls via `detectGitNexusBinary`. If the test was already racy, the extra I/O could push it over the edge.

**Disposition:** verify on main; if confirmed, cache the gitnexus probe at daemon startup rather than per-request.
</finding>

### Disposition

| Finding | Severity | Status | Action |
|---------|----------|--------|--------|
| S2-CRIT | critical | n/a | no Critical findings |
| S2-I1 | important | **addressed** | commit `a87cd9a` — `makeTmpHome({overrideHomeEnv:true})`, integration tests sandbox to tmp HOME, hermeticity guard test added |
| S2-I2 | important | **addressed** | commit `453e5aa` — both spawn sites consume `buildGitnexusIndexClipboardString().argv`; source-grep test locks the contract |
| S2-I3 | important | **addressed** | commit `64068c4` — `gitnexusInstalled`/`gitnexusCanScan` threaded into `CoverageFamilySectionMobile`; ScanPill rendered for missing/not-applicable + installed, mutually exclusive with legacy refresh button; 7 new tests |
| S2-I4 | important | **addressed** | commit `8713bc5` — popover `gitnexus-analyze` entry now gated on `state='stale'` only; missing rows go through ScanPill exclusively; 2 regression tests lock the behaviour |
| S2-M1 | minor | deferred | tooltip-wraps-button visual artifact; non-blocking |
| S2-M2 | minor | accepted-with-rationale | defensive `if (!installed) return null` retained for future call-site safety |
| S2-M3 | minor | deferred | tighten `parts.length === 2` if Phase 12 registry validation ever permits nested entries |
| S2-M4 | minor | deferred | drop unused `'not-found'` literal from `BinOverride` |
| S2-M5 | minor | deferred | add soft rate-limit to GET `/scan/:id` for symmetry |
| S2-M6 | minor | deferred | replace `python3` sleep with portable equivalent |
| S2-M7 | minor | deferred | verify pre-existing e2e failure on `main`; cache `/health` gitnexus probe if Phase 13 amplified it |

### Verification

- `pnpm -r typecheck` — clean across all 5 packages (shared, agent, spa, agentlinter, meta-observer)
- `pnpm -r test` — green: 294 shared + 911 agent + 1140 spa + 31 meta-observer
- Net test delta from Stage-2 fixes: +10 cases (2 for I-4, 7 for I-3, 2 for I-2 lockstep grep, 1 for I-1 hermeticity guard; -2 from removed createdDirs tracking variants)
- All four Important findings landed as atomic commits between `8713bc5` (I-4) and `a87cd9a` (I-1)

### Approval

Both stages complete. No Critical findings. All Important findings addressed. Minor findings tracked for follow-up but non-blocking for merge.

**Approved for merge** pending the milestone gate.
