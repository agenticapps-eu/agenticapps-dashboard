---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
artifact: review
stage_1_date: 2026-05-24
stage_1_reviewer: gsd-orchestrator (Wave 4 Task 2 — gstack /review proxy)
stage_2_status: pending
status: stage-1-complete
findings_high: 1
findings_medium: 2
findings_low: 1
findings_info: 3
high_addressed: 1
medium_addressed: 2
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

*Pending — to be filled in by an independent reviewer in a fresh context window per CLAUDE.md "Two-stage review (gstack /review + superpowers:requesting-code-review) before merging any phase. Stages do not collapse."*

**Procedure for the Stage 2 reviewer:**

1. Run `/clear` to drop all current context, OR open a fresh session in the same project root.
2. Invoke `superpowers:requesting-code-review` against the Phase 13 diff (`main...feat/phase-13-gitnexus-scoped-scan`).
3. The reviewer should produce **independent** findings — orthogonal observations, not Stage 1 re-runs.
4. Append findings here under this section using the same `<finding severity="..." id="S2-XX" file="..." lines="...">` block format.
5. Address any HIGH severity findings before merging.
6. Type `approved` in the orchestrator session once both stages are populated.

### Findings

*(empty — to be filled by Stage 2 reviewer)*

### Disposition

*(empty — to be filled by Stage 2 reviewer)*
