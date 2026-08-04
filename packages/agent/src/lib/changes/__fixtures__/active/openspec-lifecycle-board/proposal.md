## Workflow commitment

I am using the agentic-apps-workflow skill for this task.
Task scope: Promote and implement the `openspec-lifecycle-board` backlog item so OpenSpec changes become the board's primary host-scoped work items.
Task size: large

Skills I will invoke, in order:
1. `openspec-propose` — create the proposal, design, delta specs, and task plan.
2. `superpowers:brainstorming` — resolve the UI, lifecycle, association, and data-shape design.
3. `codex-design-shotgun` — establish a visual contract for the redesigned board.
4. `codex-openspec-change-review` — obtain the required independent pre-code review.
5. `openspec-apply-change` — execute the approved change tasks.
6. `superpowers:test-driven-development` and `codex-ts-declare-first` — implement behavior from RED tests with declare-first TypeScript discipline.
7. `codex-cso` — audit the changed host-storage parsing and trust boundaries.
8. `codex-qa` and `codex-impeccable-audit` — verify the changed TUI surface live and assess visual quality.
9. `superpowers:requesting-code-review` — obtain the independent Stage-3 implementation review.
10. `superpowers:verification-before-completion` — verify task, test, ADR, review, and runtime evidence.
11. `openspec-sync-specs` and `openspec-archive-change` — fold the approved guarantees into product truth and archive the completed change.
12. `superpowers:finishing-a-development-branch` — prepare the completed work for PR shipping.

Post-phase gates (if applicable): change review, code review, CSO, QA, impeccable audit.
Verification evidence I will produce: validated OpenSpec artifacts, `REVIEWS.md`, RED/GREEN test evidence, ADR(s), `SECURITY.md`, `QA.md`, `IMPECCABLE-AUDIT.md`, `REVIEW.md`, full test/typecheck results, and a live TUI check.

Once I have stated this plan, I am committed to it. Deviating without explicit user approval is a protocol violation.

## Why

The board currently promotes host-native tasks, Codex plan steps, and opencode todos into top-level cards, even though repositories using OpenSpec treat a change as the durable unit of work. A change-centric board will expose the real delivery lifecycle without discarding the task data already used by the timeline and completion notifications.

## What Changes

- **BREAKING:** Replace the board's Todo / In progress / Done / Blocked columns with Propose / Validate / Execute / Archive / Ship.
- Render one OpenSpec change card per associated host session rather than one card per host-native task.
- **BREAKING:** Omit sessions outside an OpenSpec repository or without an unambiguous change association from the default board; retain their raw tasks in timeline/notification behavior and expose an omitted-session count.
- Discover repository-local OpenSpec changes read-only, associate sessions deterministically, and derive lifecycle stage from observable artifacts, approved `REVIEWS.md` evidence, checklist progress, archive state, and local default-branch reachability.
- Add change/repository identity to cards, details, and filtering; add artifact readiness, reviewer evidence, and checklist progress to cards and details.
- Preserve host-native tasks unchanged for the timeline and notifications.
- Preserve host-task titles, statuses, and dependency text in the associated change detail pane.
- Apply the existing seven-day session-active rule to lifecycle cards in every stage; aged-out sessions neither render nor count as omitted.
- Watch associated OpenSpec and local git state so progress and stage changes remain visible within the existing one-second Core Value.
- Preserve the read-only invariant: the viewer never writes to host state, OpenSpec artifacts, or git state.

## Capabilities

### New Capabilities

- `openspec-change-tracking`: Read-only discovery, strict host-session association, lifecycle classification, checklist progress, archive/ship evidence, and repository watching for OpenSpec changes.

### Modified Capabilities

- `host-adapters`: Adapter snapshots carry normalized host-session-scoped change cards while retaining raw task data.
- `board-view`: The default board becomes a five-stage OpenSpec lifecycle view with a narrow-terminal stage pager and change-centric detail/filter behavior.
- `live-updates`: Associated OpenSpec artifact, review, task, archive, and local git-ref changes refresh cards within one second.

## Impact

- Shared model and adapter snapshot types gain normalized change-card data.
- A shared read-only OpenSpec/git tracking wrapper enriches each concrete host adapter without exposing raw files to the store or UI.
- Store aggregation and the OpenTUI board/card/detail/filter/navigation components change; timeline and notifier consumers retain the existing `Task[]` path.
- New disk fixtures, classifier/association/watcher/store/UI tests, an ADR for lifecycle and association policy, and visual/security/QA/review evidence are required.
- No new runtime dependency or write path is planned; OpenSpec state is read as bounded files, while Ship inspection uses one trusted absolute `git` executable with allowlisted non-mutating argv, sanitized configuration/environment, bounded output/time/concurrency, and optional locks disabled.
