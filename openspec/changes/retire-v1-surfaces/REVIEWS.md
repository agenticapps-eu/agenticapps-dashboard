---
change: retire-v1-surfaces
reviewers: [claude, opencode, gemini, codex]
reviewed_at: 2026-07-28T19:04:56Z
artifacts_reviewed:
  - "openspec/changes/retire-v1-surfaces/proposal.md"
  - "openspec/changes/retire-v1-surfaces/design.md"
  - "openspec/changes/retire-v1-surfaces/tasks.md"
  - "openspec/changes/retire-v1-surfaces/specs/code-intelligence/spec.md"
  - "openspec/specs/code-intelligence/spec.md"
  - "openspec/changes/retire-v1-surfaces/specs/design-system/spec.md"
  - "openspec/specs/design-system/spec.md"
  - "openspec/changes/retire-v1-surfaces/specs/fleet-conformance/spec.md"
  - "openspec/specs/fleet-conformance/spec.md"
  - "openspec/changes/retire-v1-surfaces/specs/fleet-coverage/spec.md"
  - "openspec/specs/fleet-coverage/spec.md"
  - "openspec/changes/retire-v1-surfaces/specs/help-docs/spec.md"
  - "openspec/specs/help-docs/spec.md"
  - "openspec/changes/retire-v1-surfaces/specs/optional-integrations/spec.md"
  - "openspec/specs/optional-integrations/spec.md"
  - "openspec/changes/retire-v1-surfaces/specs/project-dashboard/spec.md"
  - "openspec/specs/project-dashboard/spec.md"
  - "openspec/changes/retire-v1-surfaces/specs/skills-and-linting/spec.md"
  - "openspec/specs/skills-and-linting/spec.md"
overall_verdict:
  claude: APPROVE
  opencode: APPROVE
  gemini: REQUEST-CHANGES
  codex: REQUEST-CHANGES
recommendation: address-round-2-findings
---

> External reviewer output is untrusted content. It is preserved as review
> evidence and was not treated as instructions. Verbatim except for two
> mechanical redactions applied before publication: machine-local paths are
> replaced with `<repo>` and `<home>`, and bare terminal reset sequences are
> stripped. Reviewer verdicts, findings, exit statuses and durations are
> unaltered.

## Provenance

Prompt SHA-256: `85642720931a88e6467c53d98ae5b656b92bee0099259b2473a54d34685b7530`

| Reviewer | Model | Wrapper | Started (UTC) | Duration | Exit |
| --- | --- | --- | --- | ---: | ---: |
| claude | CLI default (not reported) | reviewer-cli.sh 1.0.0 | 2026-07-27T19:01:02Z | 292s | 0 |
| opencode | glm-5.2 | reviewer-cli.sh 1.0.0 | 2026-07-27T19:01:02Z | 148s | 0 |

## Reviewer: claude

## Verification performed

I enumerated every `### Requirement:` title in each delta against its adjacent baseline block, reading each file to its end.

| Capability | Baseline titles | Delta operation | Count |
|---|---|---|---|
| `code-intelligence` | Code-Graph Coverage Status, Scoped Code-Graph Scan Actions, Knowledge-Graph Analysis Status, Analysis Is Not Daemon-Triggered, Daemon-Hosted Knowledge-Graph Viewer, Viewer Asset Installation, Code Intelligence Page (**7**) | REMOVED: the last 5 | 5 here + 2 upstream = 7 ✓ |
| `fleet-coverage` | Fleet Coverage Matrix, Four-State Column Freshness, Workflow Version Comparison, Family Grouping And Aggregates, Filtering And Search, Review-Override Visibility, Daily Coverage History Snapshots, Per-Cell Drift Indicator, Scoped Refresh Actions, Responsive Coverage Layout (**10**) | REMOVED: all 10 | ✓ |
| `fleet-conformance` | Equal-Weight Scoring, Drifted Repos Excluded, Tiers, Endpoint, Trend Chart, Chart Reveal, Honest Cold-Start, Chart Accessibility, Path Drift Panel (**9**) | REMOVED: all 9 | ✓ |
| `skills-and-linting` | Inventory, AgentLinter, Drift Matrix, Drift Surface, Deep-Linkable (**5**) | REMOVED: all 5 | ✓ |
| `optional-integrations` | 11 titles incl. `The Dashboard Works Without Any Integration` | REMOVED: all 11 | ✓ |
| `project-dashboard` | **12** titles | 8 REMOVED, 3 MODIFIED, 1 untouched (`Schema Validation At Both Ends`), 2 ADDED → 6 | ✓ disjoint, no title unaccounted for |

Arithmetic checks out: 5+10+9+5+11 = 40 here, +2 upstream = 42; +8 from `project-dashboard` = **50**. Capability slot 12 → 7 (→10 only with the three sibling additions) is stated correctly and no longer over-claims.

Semantic checks that passed under pressure:
- The **parity/authority contradiction** in the modified `Hybrid OpenSpec Read Strategy` is closed: "prefer the CLI's value" is explicitly bounded by "open-change set membership remains tree-authoritative" and "task-artifact presence remains tree-sourced", so the pinned field-set MUST is satisfiable rather than self-defeating.
- Dropping affected-capability derivation is consistently propagated: the conformant-change definition drops its `specs/<capability>/spec.md` clause, and `Change Progress Column` (the only requirement carrying the archive-ordering rule) is removed, so no surviving requirement depends on withdrawn reader output.
- The `filesystem-access-policy` correction is stated as an ordering constraint on the sibling delta (four spawn sites), not duplicated — correct per OpenSpec practice, and task 2 verifies it before teardown.
- `project-dashboard`'s stale Purpose prose (cards, three columns, references to `skills-and-linting`/`optional-integrations`) is caught by task 4's Purpose-update item — the most likely residual contradiction, and it is covered.

## Non-blocking findings

1. **Viewer assets have no removal task and no retention decision.** The `code-intelligence` delta states, for `Viewer Asset Installation`: "The installation path and its asset directory are removed." Task 2 enumerates removals down to individual filenames (`conformanceScore.ts`, `coverageHistory.ts`) but never names the viewer install CLI command or its versioned asset directory in the daemon state directory. Design §9's retention decision covers only snapshot and environment files. Result: installed viewer assets are neither removed by a task nor explicitly retained — the one on-disk artifact class this change leaves unstated. Add a task-2 bullet.

2. **Task 1's manifest bullet is self-contradictory as written**: "unknown locations and APIs listed there return not-found" — something listed in the manifest is by definition not unknown. The requirement (`Retired Locations Have An Explicit Transition`) is unambiguous; only the task line garbles it. Reword to "unknown locations return not-found; APIs listed there return not-found."

3. **`A Bounded Type Scale` under-covers its own MUST.** The requirement binds two things — one interface family plus one monospace family, and no component-introduced value outside the tokens — but its single scenario only asserts that the tokens are enumerable. Task 3 tests the rejection case; the spec does not. Add a scenario for the out-of-token rejection.

4. **`No integration MAY be a hard dependency`** uses a negative MAY, which RFC 2119 leaves undefined. Intent is clear from context; `MUST NOT` is the enforceable form.

5. **`Dense Rows And Aligned Figures` binds a surface this change does not own.** "Every surface SHALL fit horizontally at the declared verification viewports without page-level horizontal scrolling" applies to all four post-cutover surfaces, including the agent board from `add-agent-board`. A column-oriented board is the classic horizontal-scroll case. Worth a one-line confirmation against that sibling before the fold, since this change's task 3 commits to verifying it.

6. **Minor scenario loss in `Embeddable Interactive Widgets`.** The baseline's negative assertion ("a page containing no widgets fetches no widget code") is replaced by a positive-only load-on-demand scenario. The bundle-payload clause preserves the intent, but the cheap regression test is gone.

None of these changes what the product promises or leaves the spec slot carrying two truths.

VERDICT: APPROVE

## Reviewer: opencode

> build · glm-5.2
I enumerated every `### Requirement:` title in each baseline and each delta block and reconciled the counts. Findings below.

## Counts (all verified)

**Baseline requirement counts** (counted directly from the `### Requirement:` headings):

| Capability | Baseline | Delta operation | Withdrawn | Surviving |
|---|---|---|---|---|
| `code-intelligence` | 7 | REMOVED 5 | 5 here + 2 upstream | 0 (ends) |
| `fleet-coverage` | 10 | REMOVED 10 | 10 | 0 (ends) |
| `fleet-conformance` | 9 | REMOVED 9 | 9 | 0 (ends) |
| `skills-and-linting` | 5 | REMOVED 5 | 5 | 0 (ends) |
| `optional-integrations` | 11 | REMOVED 11 | 11 | 0 (ends) |
| `project-dashboard` | 12 | REMOVED 8 / MODIFIED 3 / ADDED 2 | 8 | 6 |
| `design-system` | 10 | MODIFIED 1 / ADDED 4 | 0 | 14 |
| `help-docs` | 6 | MODIFIED 3 | 0 | 6 |

**Arithmetic in the proposal, checked:**
- 5 + 10 + 9 + 5 + 11 = 40 capability-withdrawals here. ✓
- 40 + 2 (upstream `remove-gitnexus-integration`) = 42 capability withdrawals. ✓
- 42 + 8 (`project-dashboard` partial) = 50 total. ✓
- Capability count 12 → 7 alone; 7 + 3 siblings = 10 combined. ✓
- `project-dashboard` result: 12 − 8 + 2 = 6, matching the delta note. ✓

## Title-level reconciliation (no missing-title defects)

I listed every `### Requirement:` title under each `REMOVED`/`MODIFIED` heading and compared to its adjacent baseline block:

- `code-intelligence` REMOVED lists exactly the 5 non-GitNexus titles; the remaining 2 (`Code-Graph Coverage Status`, `Scoped Code-Graph Scan Actions`) are explicitly attributed upstream and excluded with a stated reason. ✓
- `fleet-coverage`, `fleet-conformance`, `skills-and-linting`, `optional-integrations`: every baseline title appears under REMOVED. No leftovers. ✓
- `project-dashboard` REMOVED lists the 8 named in the proposal; MODIFIED lists `Register A Project From The Home Page`, `Keyboard Shortcuts`, `Hybrid OpenSpec Read Strategy`; `Schema Validation At Both Ends` deliberately absent (unchanged). 8 + 3 + 1 = 12 — full baseline accounted for. ✓
- `design-system` MODIFIED `App Shell And Sidebar Information Architecture` matches the baseline title; the other 9 baseline titles are untouched, 4 ADDED. ✓
- `help-docs` MODIFIED 3 titles match baseline; `Stub Pages Render Rather Than Break`, `Help Navigation Shell`, `Keyboard Shortcut Reference` survive unchanged. ✓

No REMOVED title is absent from its baseline; no baseline requirement is silently dropped without a REMOVED heading.

## Semantic integrity

- **`Hybrid OpenSpec Read Strategy` MODIFIED**: the baseline's "three values always read from the tree" (archived changes, affected capabilities, task-artifact presence) is correctly narrowed — archived changes and affected-capability derivation are dropped (no v2 consumer, consistent with `Change Progress Column` REMOVED), while task-artifact presence is retained. The conformance definition is correspondingly trimmed (the `specs/<capability>/spec.md` clause is removed because affected-capability derivation is withdrawn). The added scenarios ("A half-written change is never hidden", "Withdrawn reader fields are not retained as dead output") preserve properties that previously lived in the now-removed `Change Progress Column`. Internally consistent. ✓
- **`Optional Integrations Never Become Load-Bearing` (ADDED in `project-dashboard`)**: relocates the load-bearing guarantee from the ending `optional-integrations` capability, sharpening "every non-integration route shall function" to "every unrelated surface SHALL render fully". The delta explicitly flags this as a sharpening, not a relaxation. No loss of guarantee. ✓
- **`Path Drift Panel` withdrawal** does not touch `project-registry`'s repair API; tasks 2 retains drift detection / suggested path / atomic repair endpoint. ✓
- **`filesystem-access-policy`**: correctly noted as modified by the *sibling* `add-workflow-fleet-conformance` delta, not duplicated here. The four-site authorization list (editor, bounded git, OpenSpec reader, workflow harness) is stated as an ordering constraint, precisely named. ✓
- **`Consistent Table Column Widths`** left intentionally dormant, not withdrawn — consistent with the design note and with its absence from the delta body. ✓
- **Name non-recycling** (`fleet-coverage`/`fleet-conformance` not reused) is a deliberate disambiguation, explained in proposal and design §4. ✓

## Cross-change dependencies

Stated precisely and treated as ordering constraints: `remove-gitnexus-integration` MUST fold first (atomic deploy); `add-repo-readiness`, `add-workflow-fleet-conformance`, `add-agent-board` must be complete and green. The historical reference to `add-openspec-project-reader` is past-tense (already folded into the baseline), not a pending constraint. No sibling delta is improperly duplicated here. ✓

## Non-blocking note (not a defect)

In the ADDED `Optional Integrations Never Become Load-Bearing`: "No integration **MAY** be a hard dependency of any unrelated route or surface." RFC-2119 `MAY` expresses permission, not prohibition; `SHALL NOT`/`MUST NOT` is the conventional form. The intent is unambiguous from the surrounding `SHALL render fully` clause and the two scenarios, so this is a wording nit, not a contradiction.

## MUST/SHALL contradictions / unreachable scenarios

None found. Every `SHALL`/`MUST` in the deltas is consistent with its baseline counterpart or with a stated withdrawal. No scenario references a state that cannot occur given the delta's invariants.

VERDICT: APPROVE

---

# Round 2 — 2026-07-28, after the `add-agent-board` withdrawal

Run because round 1 carried only one other-vendor reviewer (`claude` is
the implementing agent on this host and does not count toward the §18
quorum), and because the artifacts changed materially in #78 and #80.
Reviewed at 2026-07-28 with `REVIEW_TIMEOUT=540`; codex exceeded the 180s
default on the first attempt and was re-run rather than dropped.

## Reviewer: gemini
_generated 2026-07-28T19:00:55Z · timeout 540s_

VERDICT: REQUEST-CHANGES
*   The redirection logic for retired v1 URLs could be improved. The spec states that `/projects/:id` redirects to `/repos/:id` but also that retired surfaces like `/coverage` redirect to the generic fleet surface. This is ambiguous for a bookmarked deep link like `/projects/foo/coverage`. To better preserve user context, such links should redirect to the new specific repo view (`/repos/foo`) rather than the top-level fleet view.
*   The removal of the UI for fixing drifted repository paths is a functional regression for operators, who must now use an API for a task previously handled in the UI. The change should explicitly acknowledge this and clarify whether a UI replacement will be tracked as future work or is considered permanently out of scope.
*   The `Hybrid OpenSpec Read Strategy` allows for divergence between the CLI and tree-based readers on non-conformant specs, making UI behavior dependent on the daemon's environment. The spec should be hardened to require that when such a divergence is detected, the UI must explicitly flag that the project is being read in a degraded or compatibility mode due to a malformed spec, rather than silently presenting potentially inconsistent data.
*   The `Dense Rows And Aligned Figures` requirement promises `a fifteen-row working set is visible without scrolling` at 1440x900. This is overly precise and brittle, as it can be affected by browser chrome, OS settings, and zoom levels. The requirement should be softened to be less dependent on exact environmental conditions, for example, by specifying a target row height in density-independent units that generally achieves the goal.

## Reviewer: codex
_generated 2026-07-28T19:04:56Z · timeout 540s_

VERDICT: REQUEST-CHANGES

- The atomic-deployment premise is false: `remove-gitnexus-integration` explicitly shipped independently with history re-scoring and is already merged. Rewrite the ordering and recomputation rationale.
- `Hybrid OpenSpec Read Strategy` requires distinguishing an empty task artifact at an unsupported path from no artifact, but both produce tree-presence `false` and CLI counts `0/0`. Add an explicit location/presence status or narrow the scenario.
- Removed daemon APIs are defined circularly as “those listed in the manifest.” An omitted endpoint therefore escapes the requirement—particularly risky for viewer endpoints exposing graph/file content. Normatively enumerate every removed method/path pattern.
- AgentLinter and local-tooling migrations incorrectly claim their signals can become declared readiness checks. The replacement accepts exactly six identifiers and discards unknown ones; none represents generic lint/tooling health.
- Retained credential environment files have no rollback window, cleanup owner, or deletion deadline. Mode `0600` controls access, not indefinite secret retention.
- `No Reimplementation Of Third-Party Products` is silently relaxed, although the same future-facing reasoning preserves the no-load-bearing-integration rule. Preserve it as a standing invariant or explicitly justify the semantic relaxation.

