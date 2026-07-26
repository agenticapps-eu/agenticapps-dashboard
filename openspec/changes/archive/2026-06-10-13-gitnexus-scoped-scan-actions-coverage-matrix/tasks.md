# Tasks — Phase 13: GitNexus scoped scan actions (Coverage matrix)

All items are complete: this phase shipped on 2026-06-10. Reconstructed from the
PLAN checklists at `docs/legacy-planning/phases/13-gitnexus-scoped-scan-actions-coverage-matrix/`.

## 13-04

- [x] B-13-01: Page-header IndexGitNexusButton removed (D-13-06) — file deleted; zero references in packages/spa/src/
- [x] B-13-02: Per-family Scan button mounted in CoverageFamilySection header (gated on canScan)
- [x] B-13-03: Per-repo Scan pill replaces ✗ cell on not-installed / installed-no-registry rows (D-13-08; gated on canScan)
- [x] B-13-04: New daemon route POST /api/gitnexus/scan accepting {scope, target}; spawns gitnexus via execa argv-array; returns scanId
- [x] B-13-05: New daemon route GET /api/gitnexus/scan/:id returns job state for polling
- [x] B-13-06: Daemon refuses scan routes when bindMode !== 'loopback' (403 BIND_REFUSED; D-13-11)
- [x] B-13-07: Per-repo lock (409 SCAN_IN_FLIGHT) + global scan-serialisation lock (D-13-EXT-01) both enforced
- [x] B-13-08: Health response exposes gitnexus: { installed, canScan }
- [x] B-13-09: SPA invalidates ['coverage'] AND ['conformance'] queries on scan terminal state (D-13-09)
- [x] B-13-10: Family scan sequential per-repo with partial-success toast (D-13-04, D-13-05)
- [x] B-13-11: Stub gitnexus fixture + integration tests cover happy path, concurrency 409, bind refusal 403, partial-success family scan
- [x] B-13-12: 13-IMPECCABLE.md artifact at 1440×900 with composite ≥ 87 (or documented calibration data point)
- [x] B-13-13: Threat model includes 9 STRIDE patterns + explicit ~/.gitnexus carve-out; /cso audit complete

## 13-08

- [x] Step 1: Write the failing test: 
- [x] Step 2: Run test, see RED: 
- [x] Step 3: Tighten the schema: 
- [x] Step 4: Run test, see GREEN: 
- [x] Step 5: Re-run whole package + downstream tests: 
- [x] Step 6: Commit: 
- [x] Step 3: Add realpath guard: 
- [x] Step 5: Re-run full agent suite + typecheck: 
- [x] Step 3: Add the guard: 
- [x] Step 3: Write `deriveFamilyReposFromFs`: 
- [x] Step 4: Wire the new helper into `startFamilyScan`: 
- [x] Step 5: Update the route to stop relying on registry for family: 
- [x] Step 6: Run test, see GREEN: 
- [x] Step 7: Run full agent suite + typecheck: 
- [x] Step 8: Commit: 
- [x] Step 1: Write the failing test (family-family collision): 
- [x] Step 3: Add family lock state: 
- [x] Step 4: Wire the family lock into `startFamilyScan`: 
- [x] Step 5: Run test, see GREEN: 
- [x] Step 6: Run full agent suite + typecheck: 
- [x] Step 7: Commit: 
- [x] Step 3: Implement the child registry: 
- [x] Step 4: Register the disposer in boot.ts: 
- [x] Step 3: Make it optional: 
- [x] Step 4: Audit consumers: 
- [x] Step 6: Run full suite: 
- [x] Step 3: Add the error-branch terminal handler: 
- [x] Step 5: Run full SPA suite + typecheck: 
- [x] Step 3: Reorder middleware: 
- [x] Step 5: Run full agent suite + typecheck: 
- [x] Step 1: Stage 1 — `/review` over the fix diff: 
- [x] Step 2: Stage 2 — `superpowers:requesting-code-review`: 
- [x] Step 3: `/cso` — security audit: 
- [x] Step 4: `/qa` — if SPA dev server is reachable: 
- [x] Step 5: Write VERIFICATION.md: 
- [x] CRITICAL #1 — RED test exists; GREEN test passes; regex change visible in diff.
- [x] CRITICAL #2 — RED test exists; GREEN test passes; realpathSync.native visible in diff.
- [x] WARNING #1 — D-13-EXT-09 recorded; FS-aligned helper visible; family-scan test covers unregistered repo.
- [x] WARNING #2 — assertRegistrationAllowed subdir-reject visible; test covers.
- [x] WARNING #3 — familyInflight Map visible; lock-released-on-finally; test covers two-scans-same-family.
- [x] WARNING #4 — ScanPill.tsx isError branch visible; test covers daemon-disappears.
- [x] WARNING #5 — activeChildren Set + disposeAllInflightScans visible; disposer registered in boot.ts.
- [x] WARNING #6 — D-13-EXT-10 recorded; schema field `optional()`; pre-Phase-13-shape payload parses cleanly.
- [x] INFO #2 — bind-mode middleware precedes zValidator; tailscale + malformed-JSON test returns 403.
- [x] All 9 atomic commits exist with `fix(13-08): ...` prefix.
- [x] Step 6: Commit verification artifacts: 
- [x] Step 1: Push: 
- [x] Step 2: Re-run Codex against the new HEAD: 
- [x] Step 3: Compose 13-08-SUMMARY.md: 
- [x] Step 4: Update PR #52 description: 
- [x] Step 5: Commit summary: 
