---
status: partial
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
source:
  - 13-00-SUMMARY.md
  - 13-01-SUMMARY.md
  - 13-02-SUMMARY.md
  - 13-03-SUMMARY.md
started: 2026-05-24T17:42:00Z
updated: 2026-05-25T14:35:00Z
---

## Current Test

[testing paused — 2 major issues found, 2 tests blocked on browser automation]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running daemon. `agentic-dashboard start` boots cleanly (banner + listening on 127.0.0.1:5193). `agentic-dashboard status` returns ok and registry count.
result: pass

### 2. /health Includes gitnexus Field
expected: `curl -s -H "Authorization: Bearer $(cat ~/.agenticapps/dashboard/auth.json | jq -r .token)" http://127.0.0.1:5193/health | jq` shows a `gitnexus: { installed, canScan }` object. With gitnexus on PATH and default loopback bind, both booleans are true.
result: pass

### 3. ScanPill Renders on Missing / Not-Applicable Rows
expected: Open the SPA, navigate to a project's Coverage panel. For rows whose gitnexus column shows "missing" or "not-applicable" (and gitnexus is installed locally), a ScanPill control is visible inline. Rows that are "fresh" do not show ScanPill.
result: pass
notes: All rows in missing state; ScanPill visible on every GitNexus cell. Negative case (fresh rows hide pill) deferred to Test 4 observation.

### 4. Per-Row Scan Happy Path
expected: Click ScanPill on a "missing" row. Pill shows running/progress state. Within ~5–30s the polling resolves, the row updates to "fresh" with a fresh timestamp, and no error toast appears.
result: issue
reported: "after clikcing the pill, I got this error that repo was not found"
severity: major
notes: |
  Root cause confirmed by reading packages/agent/src/lib/gitnexusScan.ts:151 —
  startScan() resolves the repo from the dashboard's project registry. The Coverage
  panel renders rows for every repo it discovers under ~/Sourcecode/{family}/,
  but ScanPill can only succeed for repos that were `agentic-dashboard register`'d.
  Result: ScanPill is shown on rows where scanning is structurally impossible,
  producing a "repo not found" toast on click for every unregistered row.
  Secondary observation (screenshot, severity minor): an "Install GitNexus" CTA
  is visible in the page header even though /health returns gitnexus.installed=true.

### 5. Family-Level Scan Sequential
expected: Click the family-level ScanPill at the top of a coverage family section. Pill shows running state and works through the repos sequentially (no thundering herd). On completion the section refreshes; partial failures (some repos fail) show an informational count toast (`completed/failed/total`), the section still updates for successes.
result: issue
reported: "Nothing really happens, I click scan, I get 1 repo scanned but no state changes, but after reload the first repo was scanned, afterwards nothing happens anymore"
severity: major
notes: |
  Three sub-issues:
  (a) ScanPill does not show running/progress state during family scan.
  (b) Cache invalidation on terminal (queryClient.invalidateQueries(['coverage','conformance']))
      is not firing — row only updates after manual page reload.
  (c) Partial-success informational toast (completed/failed/total) never appears.
  Daemon side likely worked correctly: only 1 repo is in the dashboard registry
  (agenticapps-dashboard itself), so family scan logically completes with 1/N
  success + (N-1)/N REPO_NOT_REGISTERED — the user saw 1 fresh row after reload,
  which confirms partial-success semantics on the daemon. Bug is SPA-side.

### 6. Old "Index gitnexus" Button Removed
expected: CoveragePage no longer shows the standalone "Index GitNexus" button (the old IndexGitNexusButton from before Phase 13). Scan affordances live only inside the row/family ScanPill now.
result: pass
notes: |
  Confirmed via git: `4d9e6a8 feat(13-03): delete IndexGitNexusButton` removed the OLD
  button. Grep finds no remaining `<IndexGitNexusButton` import/use (only doc-comments).
  User saw the header transition from "Install GitNexus" → "Refresh 47 stale" — that's
  the existing 3-state CTA (InstallGitNexusButton ↔ RefreshAllStaleButton), not a regression.
  Also clears the Test 4 secondary observation: "Install GitNexus" with /health.installed=true
  is correct — it means gitnexus binary is present but ~/.gitnexus/registry.json is empty
  (D-13-07 `installed-no-registry` state).

### 7. Popover: gitnexus-analyze Entry Dropped for Missing Rows
expected: Open the row-actions popover (kebab/overflow menu) on a row whose gitnexus state is "missing". The "gitnexus-analyze" entry is NOT present (you scan via ScanPill instead). For "stale" rows, the popover STILL offers "gitnexus-analyze" as before (S2-I4 surgical scope).
result: pass
notes: |
  User screenshots (CleanShot 16:35 + 16:36) show popover opened on agenticapps-dashboard (fresh)
  and agenticapps-workflow-core (missing). Neither contains a `gitnexus-analyze` entry.
  Missing-row case directly confirms S2-I4. Stale-row verification deferred — out of viewport
  scope for this UAT session; S2-I4 dispositions table in 13-REVIEW.md already documents
  the surgical scope.

### 8. Mobile Coverage Layout Shows ScanPill
expected: Shrink the browser to mobile width (≤ ~640px) so CoverageFamilySectionMobile takes over. ScanPill is visible for missing / not-applicable rows there too, mutually exclusive with the legacy refresh button (S2-I3).
result: blocked
blocked_by: other
reason: chrome-devtools-mcp profile locked by user's running Chrome; nyx-browser daemon socket missing. Manual viewport-resize verification deferred. Test coverage exists in CoverageFamilySectionMobile.test.tsx — automated tests are green.

### 9. Error Toast Uses Friendly Code, Not Raw Stderr
expected: Trigger a scan failure (e.g. point a repo at a path gitnexus cannot index, or use a stub failing binary). Toast shows a human-friendly message keyed off the error code (BINARY_NOT_FOUND / SCAN_FAILED / etc.) — never raw stderr text or filesystem paths. T-13-03-01.
result: pass
notes: |
  Verified incidentally in Test 4 — user reported "error that repo was not found" which is
  the SPA's `scanErrorCodeToMessage` translation for the REPO_NOT_REGISTERED error code.
  Toast surfaced a friendly code-keyed message; no raw stderr, no filesystem paths.
  T-13-03-01 mitigation confirmed in the wild.

### 10. bindMode=tailscale Disables Scan (canScan=false)
expected: Restart daemon with `agentic-dashboard start --bind tailscale`. `/health` now returns `gitnexus.canScan: false` (installed still true). In the SPA, ScanPill renders disabled / hidden — scanning is gated to loopback (D-13-11b).
result: blocked
blocked_by: other
reason: Requires killing the running daemon and restarting with `--bind tailscale` — invasive, low marginal value given Test 4 already gates the ship. Automated test coverage exists in packages/agent/src/routes/health.test.ts (the 3 D-13-11b cases).

## Summary

total: 10
passed: 6
issues: 2
pending: 0
skipped: 0
blocked: 2

## Gaps

- truth: "Clicking ScanPill on a missing row triggers a scan that completes and updates the row to fresh"
  status: failed
  reason: "User reported: after clikcing the pill, I got this error that repo was not found"
  severity: major
  test: 4
  artifacts:
    - path: "packages/agent/src/lib/gitnexusScan.ts"
      line: 151
      issue: "startScan() resolves repo from dashboard project registry only — Coverage panel renders rows for ALL repos under ~/Sourcecode/{family}/, but ScanPill can only succeed for repos that were explicitly `agentic-dashboard register`'d"
    - path: "packages/spa/src/components/panels/coverage/ScanPill.tsx"
      issue: "renders for any missing/not-applicable row without checking if the repo is dashboard-registered — produces unrecoverable REPO_NOT_REGISTERED toast on click"
  missing:
    - "EITHER: hide ScanPill on rows whose repo is not in the dashboard registry"
    - "OR: resolve repo path deterministically from {family}/{repo} → ~/Sourcecode/{family}/{repo} when not registered"
    - "OR: surface a 'Register repo to scan' CTA in place of the toast"
  debug_session: ""

- truth: "Family-level Scan: pill shows running, section refreshes on completion, partial-success toast surfaces (completed/failed/total)"
  status: failed
  reason: "User reported: Nothing really happens, I click scan, I get 1 repo scanned but no state changes, but after reload the first repo was scanned, afterwards nothing happens anymore"
  severity: major
  test: 5
  artifacts:
    - path: "packages/spa/src/components/panels/coverage/ScanPill.tsx"
      issue: "(a) no visible running-state UI during scan; (c) no partial-success count toast surfaced after family scan terminal — spec calls for completed/failed/total info toast"
    - path: "packages/spa/src/lib/queries/gitnexusScan.ts"
      issue: "(b) cache invalidation on terminal not firing — queryClient.invalidateQueries(['coverage'],['conformance']) is either not wired, not running, or running too early; row only updates after manual page reload"
  missing:
    - "ScanPill must show a visible running/progress state while a scan is in flight"
    - "On scan terminal (done|error), refetch or invalidate coverage + conformance queries so the row re-renders without manual reload"
    - "For family scans that complete with mixed outcomes, surface the informational count toast (completed/failed/total) defined in the SPA plan"
  debug_session: ""
