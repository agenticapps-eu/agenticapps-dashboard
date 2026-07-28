# Stage 2 review override — add-agent-board

## Operator authorization

On 2026-07-28 the operator wrote:

> okay you are allowed to use skip reviews

This authorizes the logged `GSD_SKIP_REVIEWS=1` escape hatch for this change.
It does not waive the Stage 3 implementation review or any security, QA,
design, or verification gate.

## Why the override is necessary

- OpenCode reviewed the final artifact bundle successfully and approved it.
- Gemini failed before inference because its configured model's daily quota was
  exhausted.
- Claude failed before inference because the account's monthly spend limit was
  reached.
- Failed vendor invocations were treated as unavailable and were not counted or
  represented as approvals.
- The older `REVIEWS.md` predates the final amendments and is not relied upon as
  current evidence.

## Final successful review provenance

| Reviewer | CLI | Provider/model | Bundle SHA-256 | Started (UTC) | Duration | Exit | Verdict |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| OpenCode | `opencode` 1.18.4 via `reviewer-cli.sh` 1.0.0 | `glm-5.2` | `eb8e7becde0136af19d2944f43bc4862483b2d072621889beedab72a3787419a` | 2026-07-28T04:48:19Z | 138s | 0 | APPROVE |

The bundle contained exactly:

- `openspec/changes/add-agent-board/proposal.md`
- `openspec/changes/add-agent-board/design.md`
- `openspec/changes/add-agent-board/specs/agent-board/spec.md`
- `openspec/changes/add-agent-board/tasks.md`

OpenCode reported no blocking findings in its final pass. Earlier OpenCode
passes found and caused amendments for runtime-schema ownership, blocker-id
scope, unreadable-state reason invariants, count/cap semantics, snapshot
transitions, deterministic ordering, future completion timestamps, and missing
security/TDD coverage.

## Scope of the override

The override permits Stage 3 implementation to begin without a second current
external-vendor approval. It must be supplied explicitly to the change gate and
must remain visible in command output and commit evidence. It does not convert
the stale two-reviewer `REVIEWS.md` into current evidence.
