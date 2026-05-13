---
phase: 10
reviewers: [gemini, codex]
reviewed_at: 2026-05-13T10:27:46Z
reviewer_versions:
  gemini: gemini-cli 0.28.2
  codex: codex-cli 0.130.0
runtime: claude-code (self-skipped for independence)
plans_reviewed:
  - 10-01-PLAN.md
  - 10-02-PLAN.md
  - 10-03-PLAN.md
  - 10-04-PLAN.md
  - 10-05-PLAN.md
  - 10-06-PLAN.md
  - 10-07-PLAN.md
  - 10-08-PLAN.md
prompt_size_bytes: 389492
---

# Cross-AI Plan Review — Phase 10 (Coverage Matrix Page)

Two external AI CLIs were invoked with identical context (PROJECT.md head, ROADMAP §Phase 10, COV-01..COV-12, CONTEXT.md, RESEARCH.md, UI-SPEC.md, VALIDATION.md, all 8 PLAN.md files) and an adversarial review prompt. Claude (the host) was skipped to preserve reviewer independence.

The two reviewers diverged sharply on risk level: **gemini = LOW**, **codex = HIGH**. The Consensus Summary at the end of this document reconciles the gap and identifies what to actually block on.

---

## Gemini Review

*Reviewer: `gemini-cli 0.28.2` (Google Gemini, default model). Verdict: `LOW` risk overall.*

Here is a structured, adversarial review of the implementation plans for Phase 10.

### 1. Per-Plan Analysis

*   **Plan 10-02 (Wave 1 - Scanners)**
    *   **Concerns:**
        *   `MEDIUM`: The proposed `wikiScanner` logic in `RESEARCH.md` uses `s.path.startsWith(repoName)` to check if a repository is included in the wiki sources. This is a potential bug. If two repositories have similar names (e.g., `my-app` and `my-app-worker`), a check for `my-app` would incorrectly match both. This could lead to inaccurate "Wiki linked" statuses.
    *   **Suggestions:**
        *   The wiki source path matching should be more precise. Change the check to `s.path === repoName || s.path.startsWith(repoName + '/')`. This ensures that it only matches the exact directory or subpaths within it, preventing false positives from partial prefix matches.

*   **Plan 10-03 (Wave 1 - Orchestration)**
    *   **Concerns:**
        *   `MEDIUM`: The `coverageScan` orchestrator plans to use `Promise.all` to execute scanners for all repositories in parallel. If a scanner for a single repository fails due to an unexpected error (e.g., a file with invalid permissions), `Promise.all` will reject, causing the entire `/api/coverage` endpoint to fail. This makes the page fragile; a single problematic repository could render the entire feature unusable.
    *   **Suggestions:**
        *   Replace `Promise.all` with `Promise.allSettled`. This will ensure that all scans complete, even if some fail. The orchestrator should then process the results, logging any errors and either excluding the failed repositories from the response or including them with a specific error state. This makes the system more resilient.

*   **Plan 10-04 (Wave 2 - Route)**
    *   **Concerns:**
        *   `LOW`: The proposed implementation for `POST /api/coverage/refresh` involves re-running the full `scanCoverage()` orchestrator just to find the absolute path of the repository being refreshed. This is inefficient, as it rescans all ~45 repositories for every single refresh action.
    *   **Suggestions:**
        *   Optimize the `POST /coverage/refresh` handler. Instead of calling the full `scanCoverage()`, call the synchronous `discoverRepos()` function (from Plan 10-02) and find the matching repository to get its `absPath`. This avoids unnecessary asynchronous work and filesystem I/O.

*   **Plan 10-06 (Wave 3 - SPA Components)**
    *   **Concerns:**
        *   `MEDIUM`: The "Refresh all stale" button functionality is a key feature but is underspecified in the UI spec and only added as a fix in the plan for `CoveragePage`. The proposed implementation of a sequential `await` loop inside the component could lead to a poor user experience, potentially making the UI unresponsive during a batch refresh without clear feedback.
    *   **Suggestions:**
        *   The UI must provide explicit progress feedback during a batch refresh (e.g., "Refreshing 2 of 10..."). The sequential `for...of` loop with `await` is the correct approach for serialization to prevent concurrent writes (mitigating Pitfall 8), but the plan and tests for `CoveragePage` must be updated to include requirements for this progress indication.

*   **Plan 10-07 (Wave 4 - Route Mount)**
    *   **Concerns:**
        *   `LOW`: The plan for URL state management relies on a simple comma-joined string for the `status` parameter (e.g., `?status=missing,stale`). This creates an implicit contract between the `CoverageToolbar` (which creates the string) and the `CoveragePage` (which parses it). This is fragile.
    *   **Suggestions:**
        *   Strengthen the contract at the router level. Use the `zodValidator` with a more specific schema for the `status` parameter, such as a `transform` to split the string into an array and validate each key. This makes the URL parsing more robust and centralizes the validation logic.

### 2. Cross-Plan Analysis

*   **Dependency / Sequencing Issues:** None. The wave-based, bottom-up plan structure (Schema → Scanners → Orchestration → Route → UI) is logical and sound.
*   **Contract Drift Risk:** Low. The use of a shared Zod schema package (`10-01`) is the correct and most effective mitigation. The implicit contract in the `status` URL parameter is a minor weakness but is contained within the SPA.
*   **Scope Creep / Over-engineering:** None. The plans show excellent discipline in controlling scope, notably the decision to de-scope headless wiki compilation (D-10-09).
*   **Missing Edge Cases:** The main missing edge case is the orchestrator's lack of resilience to single-repo scan failures, as noted in the `10-03` analysis. Using `Promise.allSettled` would address this.

### 3. Security Review

The security posture of these plans is exceptionally strong.
*   **Filesystem Access:** The new cross-family filesystem access is correctly channeled through the existing, audited `resolveAllowedNamed` primitive. The old, more permissive `/api/projects/:id/read` route is explicitly not widened. This demonstrates a robust understanding of least-privilege principles.
*   **Subprocess Spawning:** The planner correctly identified the security risks of spawning subprocesses. The mitigations are comprehensive:
    1.  The attack surface was minimized by reducing spawnable commands to just `gitnexus analyze`.
    2.  The "no `npx`" rule (D-5-21) is correctly enforced, mitigating supply-chain risks.
    3.  Command injection is prevented by exclusively using `execa` with argv arrays.
*   **Input Validation:** User-controlled input (`{ repo, action }`) is validated by Zod schemas on the backend.

No significant security risks were found. The plans demonstrate a mature security-first mindset.

### 4. Goal-Backward Check

All twelve `COV-XX` requirements are explicitly mapped to verification steps in the `VALIDATION.md` file and trace clearly to artifacts produced in the eight plans. The coverage is complete.

### 5. Risk Assessment

*   **Overall Risk Level:** `LOW`.
*   **Justification:** While the feature is complex and expands the daemon's trust boundary, the planning is meticulous. Risks have been proactively identified and mitigated through robust architectural patterns, reuse of audited security primitives, a comprehensive TDD strategy, and clear-headed scope control.
*   **Top 3 Risks:**
    1.  **Orchestrator Fragility:** A single-repo scan failure could take down the entire feature. (See `10-03` analysis).
    2.  **Incorrect Wiki Status:** The `startsWith` logic bug in `wikiScanner` could display incorrect data, eroding user trust in the dashboard. (See `10-02` analysis).
    3.  **Poor UX on Batch Refresh:** The "Refresh all stale" action could lock up the UI without progress feedback, frustrating the user. (See `10-06` analysis).

---

## Codex Review

*Reviewer: `codex-cli 0.130.0` (OpenAI Codex). Verdict: `HIGH` risk overall — boundary enforcement, schema fidelity, and refresh contract are flagged as wrong-in-different-ways.*

**Per-Plan**
**10-01**
- `HIGH` Shared schema leaks `absPath` to the SPA (`CoverageRowSchema`). That is unnecessary local-path disclosure across the new trust boundary.
- `HIGH` `CoverageColumnStateSchema` is too lossy for `COV-08`. You throw away `installedVersion`, `headVersion`, and structured workflow detail, then expect the SPA to render `behind`, `ahead`, and `version unknown` correctly.
- `HIGH` Refresh contract already drifts from requirements. Schema accepts `{ family, repo, action }`, not `{ repo, action }`, and the response makes `updatedRow` optional even though `COV-04` says refresh returns updated row state.
- `Suggestions`
- Remove `absPath` from the shared response schema; keep it daemon-only.
- Add structured per-column metadata, especially for workflow: `detail`, `installedVersion`, `headVersion`, maybe `via` for CLAUDE/AGENTS.
- Either amend the requirement or make the API contract match it exactly.

**10-02**
- `HIGH` Scanner plan reads external filesystem paths directly. It does not actually route reads through `resolveAllowedNamed`, even though `COV-02` and the security model say the new roots should be allow-listed.
- `HIGH` `repoDiscovery` accepts symlinked top-level directories because it uses `statSync` and only checks for `.git`. A symlink placed under `~/Sourcecode/<family>` can escape the family root.
- `MEDIUM` `workflowVersionScanner` says "identify by frontmatter `name:`", but the planned implementation does not enforce that; it only checks candidate paths.
- `MEDIUM` Wiki source matching via `startsWith(repoName)` will overmatch (`app` matches `app2/...`).
- `Suggestions`
- Centralize all external path resolution through a helper that uses `resolveAllowedNamed` or equivalent canonical root checks before every read.
- In discovery, reject symlinked repo directories or require `realpath(abs)` to stay under the family root.
- Verify `name === 'agentic-apps-workflow'` in workflow SKILL frontmatter.
- Match wiki sources with `path === repoName || path.startsWith(repoName + '/')`.

**10-03**
- `HIGH` Plan extends `paths.ts`, but the orchestrator/scanners still bypass it. The allow-list extension is effectively dead code unless every scanner uses it.
- `HIGH` `scanCoverage()` returns rows containing `absPath`, so the privacy leak becomes systemic.
- `MEDIUM` No partial-failure isolation. One unexpected scanner throw can 500 the whole matrix instead of degrading one cell/row.
- `Suggestions`
- Make path-resolution part of the scanner API, not an optional side utility.
- Keep `absPath` only in an internal row model; strip before emitting `CoverageResponse`.
- Wrap per-repo scans so one bad repo yields a degraded row, not total route failure.

**10-04**
- `HIGH` `POST /api/coverage/refresh` does not satisfy `COV-04`. Plan text explicitly says `updatedRow` may be omitted and SPA should refetch later.
- `HIGH` Route rejects `wiki-compile`, while `COV-04` still says unsafe actions return a clipboard string instead of spawning. The requirement and route plan are not aligned.
- `MEDIUM` Refresh route re-scans the full matrix just to map `{family, repo}` to a path. That is wasteful and creates extra race surface.
- `MEDIUM` No daemon-side serialization/mutex for refreshes. The UI serializes batch refresh, but concurrent tabs/clients can still collide.
- `Suggestions`
- Either update `COV-04` to the narrowed contract or implement clipboard-return responses server-side.
- Return a real updated row after refresh, even if you also invalidate/refetch.
- Resolve repo path directly from `family + repo` at request time with canonical root checks.
- Add a per-repo or global refresh lock on the daemon.

**10-06**
- `HIGH` `COV-10` says the install hint is at the family aggregate level. Plan/UI moved it to a page-level banner. That is a spec miss, not a styling choice.
- `MEDIUM` Family aggregate count semantics are underdefined and likely misleading. Current plan counts rows into multiple buckets if a repo has both missing and stale columns, so totals can exceed repo count.
- `MEDIUM` Clipboard command builders are duplicated in SPA after being defined in agent planning. Drift risk is high.
- `LOW` Clipboard actions assume `navigator.clipboard` availability; no fallback path is planned.
- `Suggestions`
- Either move the GitNexus hint into each family header or amend `COV-10`.
- Define one row-level aggregation rule: worst-state wins, or explicit separate column-count chips.
- Put clipboard payload constants in `shared`, not duplicated in SPA/agent.
- Add clipboard failure handling.

**10-07**
- `MEDIUM` Playwright plan is machine-state dependent: daemon must be running, pairing must be seeded, GitNexus absence is assumed, overrides are optional. This will be flaky outside the author's machine.
- `Suggestions`
- Back the e2e with fixed API mocks/fixtures, or clearly mark it as local-only and add one deterministic browser-level mocked test in CI.

**10-08**
- `MEDIUM` Smoke test skips if `claude-workflow` clone is missing, which means the main protection for `COV-12` can silently disappear in CI.
- `Suggestions`
- Add a repo-local fixture test for expected migration frontmatter shape, and keep the cross-repo smoke test as additive.

**Cross-Plan Analysis**
**Dependency / Sequencing Issues**
- `HIGH` Mandatory phase gates are not actually planned as executable tasks: `/cso`, `/qa`, `impeccable >= 90`, two-stage review, and the human UAT artifact are mentioned in context but not scheduled.
- `MEDIUM` Plan 06 depends on route search semantics from Plan 07 for real behavior, but tests appear to mock around that coupling rather than prove the integrated path.
- `MEDIUM` Plan 08 changes workflow head to `1.8.0` after most UI/QA work. That means pre-merge screenshots and workflow-column behavior can differ before/after the upstream PR lands.

**Contract Drift Risk**
- `HIGH` Shared schema is not rich enough for the UI the later plans want to render.
- `HIGH` Refresh API contract drifts across requirements, shared schema, route plan, and SPA behavior.
- `HIGH` Clipboard action strings are duplicated instead of shared.
- `MEDIUM` `family` is injected into request contract even though requirement/review framing still says `{ repo, action }`.

**Scope Creep / Over-Engineering**
- `MEDIUM` Wave 0 "RED-state" is mostly `it.todo`. That is not red; it is bookkeeping. High ceremony, low enforcement.
- `LOW` 20+ stub test files before core security/contract issues are solved is backward. The risky parts are API shape and path trust, not test-file count.

**Missing Edge Cases**
- `HIGH` Symlinked repo root escapes family boundary.
- `HIGH` TOCTOU on refresh: repo discovered during scan can be replaced before spawn unless path is re-canonicalized at POST time.
- `MEDIUM` One scanner/repo failure can currently poison the entire matrix.
- `MEDIUM` Aggregate counts semantics are undefined.
- `MEDIUM` Clipboard failure / browser permission denial is unhandled.
- `MEDIUM` No explicit verification of `COV-03` cold-load `<1s`; cache exists, performance proof does not.

**Security Review**
- `HIGH` The new trust boundary is not actually enforced if scanners read directly from computed paths. `resolveAllowedNamed` cannot just exist; it must gate every external read.
- `HIGH` `absPath` in API responses is unnecessary sensitive local data exposure.
- `HIGH` Top-level symlink repo discovery is an escape hatch. A symlink inside `~/Sourcecode/agenticapps` can point anywhere and still be scanned/spawned.
- `MEDIUM` Refresh route accepts user-controlled `{ family, repo, action }`. Even with enum-locked action, the daemon must re-resolve and canonicalize the repo path under the allowed family root immediately before spawn.
- `MEDIUM` UI-only serialization is not enough. Another client/tab can issue concurrent refresh POSTs.
- `LOW` Command injection risk is mostly contained because argv arrays are used, but keep it that way and forbid shell-string helpers entirely.

**Goal-Backward Check**
- `COV-01` Mostly covered.
- `COV-02` Not convincingly covered. Plans add roots but do not prove scanners actually use allow-listed resolution.
- `COV-03` Cache covered; `<1s` cold-load target is not verified.
- `COV-04` Not fully covered. Current plans reject clipboard-only actions server-side and do not reliably return updated row state.
- `COV-05` Covered, assuming row/group semantics are accepted.
- `COV-06` Covered, but count semantics remain fuzzy.
- `COV-07` Covered.
- `COV-08` Partially covered; shared schema is too weak for the specified workflow UX.
- `COV-09` Covered.
- `COV-10` Not fully covered. Hint location drifted from family aggregate level to page-level banner.
- `COV-11` Covered at the enum level.
- `COV-12` Covered, but CI protection is weak if cross-repo smoke skips.

**Risk Assessment**
- `HIGH`
- The plans are strong on decomposition and weak on the actual hard parts: boundary enforcement, API contract consistency, and data-model fidelity. The biggest failure mode is shipping something that "works" in the happy path while leaking local paths, bypassing the intended allow-list model, and missing the exact refresh/workflow behaviors the phase is supposed to introduce.

**Top 3 Single-Point-of-Failure Risks**
- The shared schema is wrong: `absPath` leak plus insufficient workflow metadata will force downstream hacks or spec misses.
- The filesystem trust boundary is wrong: scanners/discovery can escape family roots via direct reads and symlinks.
- The refresh contract is wrong: `COV-04` is currently split between requirement text, daemon route behavior, and SPA clipboard behavior.

---

## Consensus Summary

The two reviewers disagree on overall risk (gemini `LOW`, codex `HIGH`). The disagreement is real and substantive: gemini accepts the planning at face value (sees shared Zod, sees `resolveAllowedNamed`, concludes "good"), while codex reads the implementation steps of each plan and notices that the audited primitives are referenced in plan prose but not actually wired into every read site. **Codex is more correct on this dimension** — `resolveAllowedNamed` existing in `paths.ts` does nothing unless every scanner routes through it, and the plans currently don't enforce that. Treat codex's review as the binding finding set unless invalidated by re-reading.

### Agreed Strengths (both reviewers concur)

- **Wave decomposition is sound** — Schema → Scanners → Orchestration → Route → UI is the right shape.
- **Subprocess narrowing to `gitnexus analyze`** (D-10-09) and the no-`npx` rule (D-5-21) are correct architectural decisions.
- **Shared Zod schemas as the contract source** is the right pattern (even if execution details on what to put in those schemas need fixing — see Agreed Concerns).
- **TDD ambition is high** — both reviewers acknowledge it, though codex separately flags Wave 0 as "ceremony" rather than enforcement.

### Agreed Concerns (raised by both reviewers — highest priority)

These are the items that survived independent review by two different model families and should be treated as blocking until addressed:

1. **`wikiScanner` `startsWith(repoName)` over-matches.** Both reviewers flagged this independently. Fix in Plan 10-02: change predicate to `s.path === repoName || s.path.startsWith(repoName + '/')`. **Severity: MEDIUM** (gemini) → **HIGH effective** (data integrity bug that propagates to UI).
2. **No partial-failure isolation in `scanCoverage` orchestrator.** Both flagged the `Promise.all` fragility. Fix in Plan 10-03 Task 2: switch to `Promise.allSettled`, define a degraded-row state in the schema (codex's point), and surface it visibly (worst-state-wins per row).
3. **Refresh route inefficiency (full re-scan to resolve path).** Both flagged. Fix in Plan 10-04: resolve `family + repo` directly via `discoverRepos()` synchronously at request time with canonical root checks (codex framing — adds TOCTOU mitigation on top of the perf concern).
4. **`Refresh all stale` UX underspecified.** Gemini directly + codex indirectly via "Wave 0 is ceremony" / "Plan 06 depends on Plan 07 search semantics". Fix in Plan 10-06: add explicit `<batchProgress>` state and tests for "Refreshing N of M…" indicator.

### Codex-Only Concerns Worth Surfacing (HIGH severity, gemini missed)

These are codex findings that gemini did **not** raise but appear substantive on re-reading the plans. They are the strongest argument for `/gsd-plan-phase 10 --reviews` over jumping straight to execution:

1. **`absPath` leak in `CoverageRowSchema`** (Plans 10-01 + 10-03). The shared response schema currently exposes absolute local paths to the browser. Even on loopback this is unnecessary path disclosure. Fix: hold `absPath` in an internal-only `InternalCoverageRow` type inside the daemon; strip before emitting `CoverageResponse.parse(...)`.
2. **`repoDiscovery` symlink escape.** Plan 10-02's `repoDiscovery` uses `statSync` + `.git` check, no `realpath` confinement under the family root. A symlink placed under `~/Sourcecode/agenticapps/` could expand the scanner / spawner reach to arbitrary directories. Fix: require `realpathSync(repoAbs).startsWith(familyRoot + '/')` before accepting a repo.
3. **`resolveAllowedNamed` extension is dead code** unless every scanner routes external reads through it. Plan 10-03 extends `paths.ts` but the scanner plans bypass it. Fix: make path resolution a required scanner argument; reject any direct `fs.read*` in scanner code via grep acceptance criteria.
4. **`CoverageColumnStateSchema` is too lossy for COV-08.** The 4-state enum (`fresh`/`stale`/`missing`/`not-applicable`) cannot express the "installed 1.7.0, behind head 1.8.0" / "ahead with annotation" / "version unknown" sub-cases the requirement (and UI-SPEC) describe. Fix: add a discriminated-union variant for the workflow column carrying `installedVersion`, `headVersion`, `detail`.
5. **Refresh contract drift across requirements / schema / plans.** COV-04 says `{ repo, action }`; Plan 10-01's schema accepts `{ family, repo, action }`; Plan 10-04 makes `updatedRow` optional even though COV-04 requires it; D-10-09 says wiki-compile returns a clipboard string but Plan 10-04 rejects wiki-compile at the request-body Zod parse. Pick one canonical contract and make all four artifacts (REQUIREMENTS / shared schema / route / SPA hook) match it.
6. **COV-10 hint location drift.** The requirement says the GitNexus install hint sits at the **family aggregate** level; the UI-SPEC / Plan 10-06 moved it to a page-level banner (`CoverageGitNexusBanner`). Either amend COV-10 or move the hint back into each family header.
7. **Post-phase mandatory gates (`/cso`, `/qa`, impeccable ≥ 90, two-stage review, HUMAN-UAT.md) are not scheduled.** CONTEXT.md lists them; no plan task tracks them. They will get skipped under deadline pressure unless converted into executable tasks (likely a `10-09-PLAN.md` or extended into 10-08).

### Divergent Views

- **Risk level (LOW vs HIGH).** The divergence comes down to "does the plan describe the right architecture?" (gemini answer: yes) vs "does the plan actually wire that architecture into every read site?" (codex answer: no). Codex's adversarial frame is the correct one for plan-review.
- **Wave 0 RED-state.** Codex calls it "ceremony — `it.todo` is not red"; gemini does not comment on it. The planner's intent was that the per-test-file `it.todo` stubs lock the test surface and harness so Wave 1+ can fill them in TDD-style. Codex's critique is fair (a `it.todo` does not fail in the TDD-red sense), but the structural intent is real. Decision deferred to the planner: either rename "RED-state stubs" to "test scaffold" in plan language, or convert at least the security/contract tests in Wave 0 to genuinely-failing tests (which would then pull Plans 10-02/03 forward).
- **e2e flakiness (Plan 10-07).** Codex says the Playwright spec is machine-state dependent; gemini did not flag it. Codex's concern is valid in principle but the Phase 7 e2e set the precedent of "local-deterministic + CI-skipped by environment guard". If CI never runs the e2e, the concern is moot; if it will, codex's mocked-API recommendation should land.

### Recommended Next Steps

1. **Run `/gsd-plan-phase 10 --reviews`** to incorporate the Agreed Concerns + the codex-only HIGH-severity items above. The planner should treat #1–#7 in "Codex-Only Concerns" as binding amendments and #1–#4 in "Agreed Concerns" as required plan-text fixes.
2. **Decide the refresh contract first** (codex finding #5). This is the single biggest cross-plan churn lever — pin `{ family, repo, action }` + required `updatedRow` + clipboard-return for unsafe actions, then propagate to REQUIREMENTS.md (amend COV-04 wording), `coverage.ts` schema, Plan 10-04 route handler, and Plan 10-05 SPA hook.
3. **Add a `10-09-PLAN.md` (or extend 10-08)** to schedule the post-phase gates as concrete tasks: `/review` Stage 1, `superpowers:requesting-code-review` Stage 2, `/cso`, `/qa`, impeccable ≥ 90 critique, HUMAN-UAT.md scaffold. Codex's "mandatory gates not planned" is the most leveraged risk to fix.
4. **Grep acceptance criterion** in the replanned 10-02/10-03: ban `fs.readFile|fs.readFileSync|fs.stat|fs.statSync|fs.readdir|fs.readdirSync` outside the path-resolution helper inside `packages/agent/src/lib/coverageScan*.ts` to enforce the codex finding #3.

### How to feed this back into planning

```
/gsd-plan-phase 10 --reviews
```

The planner reads `10-REVIEWS.md`, identifies amendments, updates plans atomically, and re-runs plan-checker. Codex's findings #1–#5 are likely to produce schema/route plan rewrites; gemini's findings produce per-task amendments in Plans 10-02/03/06/07.
