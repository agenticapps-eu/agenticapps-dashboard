---
status: diagnosed
trigger: "Per-row ScanPill click → 'repo not found' toast; scan never starts; row stays missing. UAT Test 4."
created: 2026-05-25T18:00:00Z
updated: 2026-05-25T18:00:00Z
---

## Current Focus

hypothesis: Plan 13-03 wired ScanPill onto every `gitnexusInstalled && (state==='missing'|'not-applicable')` row, but the daemon's `startScan()` REQUIRES the repo to be in the dashboard's project registry (`~/.agenticapps/dashboard/registry.json`). The Coverage matrix lists ALL repos discovered under `~/Sourcecode/{family}/`, NOT just registered ones. Scope mismatch between row-render eligibility and daemon-resolvable repos.
test: code reading (no runtime test needed — the contradiction is structural)
expecting: confirm both surfaces and that no path bridges them
next_action: write up the root cause report

## Symptoms

expected: Clicking ScanPill on a missing row triggers a scan that completes and updates the row to fresh.
actual: Toast surfaces "repo not found" (SPA's `scanErrorCodeToMessage('REPO_NOT_REGISTERED')`), scan never starts, row stays missing.
errors: REPO_NOT_REGISTERED error code from daemon
reproduction: UAT Test 4 — open SPA, navigate to Coverage, click ScanPill on any row whose root is not in dashboard registry.
started: Phase 13 ship — Plan 13-03 (commit 381ae97) wired ScanPill onto rows without gating on registry membership.

## Eliminated

- hypothesis: ScanPill is rendering on rows where the design intends to hide it
  evidence: CoverageRow.tsx:153 — gate is `gitnexusInstalled && (state==='missing'||'not-applicable')`. Per D-13-08 (CONTEXT line 24), this is *exactly* the design intent for which rows show ScanPill. The render gate is correct per spec.
  timestamp: 2026-05-25T18:00:00Z

- hypothesis: Daemon registry resolution is buggy (e.g. wrong path, race on registry.json)
  evidence: gitnexusScan.ts:151 is a straightforward `reg.projects.find(p => derivedRepoId(p.root) === repoId)`. derivedRepoId at line 367 deterministically parses `~/Sourcecode/{family}/{repo}` shape. UAT Test 5 partial-success (1 repo scanned out of N) confirms registry lookup works correctly for entries that ARE present. The bug is "registry membership is too small a set", not "registry lookup is broken".
  timestamp: 2026-05-25T18:00:00Z

- hypothesis: Schema drift / wire-shape mismatch
  evidence: Test 9 (Error Toast Uses Friendly Code) passed — the SPA correctly translated REPO_NOT_REGISTERED to its friendly message. Wire contracts are intact; the error code arrived faithfully. The bug is in the *semantics* of when REPO_NOT_REGISTERED gets returned, not in any contract.
  timestamp: 2026-05-25T18:00:00Z

## Evidence

- timestamp: 2026-05-25T18:00:00Z
  checked: packages/agent/src/lib/gitnexusScan.ts:139-186 (startScan) + :367-379 (derivedRepoId)
  found: startScan() resolves repo via `readRegistry(opts.registryFile).projects.find(p => derivedRepoId(p.root) === repoId)`. Returns `{ok:false, code:'REPO_NOT_REGISTERED'}` if not found. `entry.root` is then used as the cwd for the gitnexus subprocess at :290.
  implication: The daemon EXCLUSIVELY trusts the dashboard project registry as the source of `repoId → absolute path` mapping. There is no fallback to a deterministic `~/Sourcecode/{family}/{repo}` resolver for unregistered repos.

- timestamp: 2026-05-25T18:00:00Z
  checked: packages/spa/src/components/panels/coverage/CoverageRow.tsx:148-167
  found: ScanPill is rendered for every row whose `gitnexus.state` is 'missing' or 'not-applicable' AND `gitnexusInstalled === true`. No check against any registry-membership signal. There is no `registered: boolean` field on the row.
  implication: The SPA assumes (incorrectly) that every coverage row can be scanned by the daemon. It has no knowledge of dashboard-registry membership.

- timestamp: 2026-05-25T18:00:00Z
  checked: packages/shared/src/schemas/coverage.ts (CoverageRow shape via 13-RESEARCH.md notes + Plan 11 reuse of the schema)
  found: CoverageRow has `{family, repo, claudeMd, gitNexus, wiki, workflowVersion, overrideCount, overrides}` — NO `absPath`, NO `registered`, NO `inRegistry` flag.
  implication: The wire contract carries enough info to RENDER coverage state for every repo discovered under `~/Sourcecode/{family}/`, but does NOT carry any signal about whether a given repo is in the dashboard's project registry. The SPA cannot today gate ScanPill by registration without a contract addition.

- timestamp: 2026-05-25T18:00:00Z
  checked: .planning/phases/13-gitnexus-scoped-scan-actions-coverage-matrix/13-CONTEXT.md lines 18-24 (D-13-06/07/08); 13-RESEARCH.md lines 838-841 (V5/V12 Input Validation rationale); 13-RESEARCH.md line 847 (T-13-02-01 mitigation).
  found: D-13-08 says "replace ✗ cell content with `Scan` pill" on `not-installed`/`installed-no-registry` rows — those refer to *gitnexus* states (per Phase 10.6 enum), not dashboard-registry membership. V5/V12 explicitly justify the registry-as-allowlist design: "repo path resolved server-side via registry lookup, NEVER from POST body" — this is a deliberate security choice (T-13-02-01: argument injection mitigation), not an oversight.
  implication: The architectural intent baked into Phase 13 is registry-as-allowlist on the daemon side. The SPA design implicitly assumed registry membership ≈ "everything visible in Coverage", which is false in practice (user reports: only 1 of N repos under ~/Sourcecode is dashboard-registered).

- timestamp: 2026-05-25T18:00:00Z
  checked: Phase 11 Coverage Scanner (per STATE.md line 128: "Family enum locked to ['agenticapps','factiv','neuroflash','other'] — derived from path-prefix match against ~/Sourcecode/, not from registry.client (null for every live entry)")
  found: Coverage discovery is filesystem-driven (path-prefix scan under ~/Sourcecode/), not registry-driven. Phase 10's `scanCoverageInternal` reads every repo directory under each family root; the dashboard registry was never the source set for Coverage rows.
  implication: The "Coverage shows N repos, registry holds K<N" asymmetry is a load-bearing Phase 10/11 design choice. It is the discovery model that makes the Coverage matrix useful (cross-family observability without forcing the user to `register` every repo). The bug is not "Coverage shows too many rows" — it's "Phase 13 wired a daemon-write affordance onto rows that were never required to be daemon-known".

- timestamp: 2026-05-25T18:00:00Z
  checked: 13-UAT.md Test 6 (Old "Index gitnexus" Button Removed) + 13-UAT.md Test 5 (Family-Level Scan Sequential)
  found: User report on Test 5: "Daemon side likely worked correctly: only 1 repo is in the dashboard registry (agenticapps-dashboard itself), so family scan logically completes with 1/N success + (N-1)/N REPO_NOT_REGISTERED". This is direct empirical confirmation that the dashboard registry currently holds 1 entry (this project itself) while the Coverage panel lists ~22 repos (per 13-CONTEXT.md line 122).
  implication: The "register your repos first" workaround is not realistic UX — it would require the user to run `agentic-dashboard register <path>` 22 times before the per-row Scan affordance becomes useful. That is exactly the friction Phase 13 was meant to remove.

## Resolution

root_cause: Phase 13 Plan 13-03 wires `<ScanPill>` onto every CoverageRow whose `gitnexus.state` is `missing`/`not-applicable` when `gitnexusInstalled === true` (CoverageRow.tsx:153), but the daemon's `startScan()` resolves the absolute repo path EXCLUSIVELY via dashboard-registry lookup (`readRegistry(...).projects.find(p => derivedRepoId(p.root) === repoId)` at gitnexusScan.ts:151). Coverage matrix rows are sourced from filesystem discovery under `~/Sourcecode/{family}/` (Phase 10/11), so the set of rendered rows is a strict superset of the registered set — typically the registry holds 1 entry (agenticapps-dashboard) while Coverage lists ~22 rows. Every click on an unregistered row produces a 404 REPO_NOT_REGISTERED that the SPA translates to "repo not found".

fix: not applied (goal: find_root_cause_only)

verification: n/a (diagnose-only)

files_changed: []
