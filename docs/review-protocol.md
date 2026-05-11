# Two-Stage Review Protocol

> Phase 6 POLISH-05. Source: `.planning/PROJECT.md` (non-negotiable: "stages do not collapse — they catch different failures"). Decisions: D-6-12, D-6-13, D-6-14 in `.planning/phases/06-polish-service-install-acceptance/06-CONTEXT.md`.

## Why two stages

Stage 1 catches divergence from the spec and the locked decision log. Stage 2 catches code-quality and security drift. They are run by different skills with different reviewer prompts; collapsing them produces the average failure mode of both rather than the best of either.

## Stage 1 — gstack `/review`

- **Run:** `/review` against the open PR (inside Claude Code).
- **Reviewer prompt:** spec-compliance against `.planning/PROJECT.md`, `.planning/ROADMAP.md`, the phase's `XX-CONTEXT.md`, and each affected `XX-NN-PLAN.md`.
- **Catches:** locked decision drift (`D-XX-NN` violations), missing requirement coverage, scope creep, plan-vs-shipped mismatches.
- **Output:** `<finding>` blocks appended verbatim to the PR description under `## Stage 1 — gstack /review`.

## Stage 2 — `superpowers:requesting-code-review`

- **Run:** `superpowers:requesting-code-review` against the same PR — ideally in a fresh session (context-blind reviewer).
- **Reviewer prompt:** independent code-quality + security pass. The reviewer does **not** read `XX-CONTEXT.md` — per the project's auto-memory (`feedback_code-review-vs-context.md`), context-blind review surfaces real bugs by treating locked phase values as suspicious.
- **Catches:** logic bugs, type-safety regressions, untested branches, security antipatterns, anti-AI-slop drift.
- **Output:** `<finding>` blocks appended under `## Stage 2 — superpowers:requesting-code-review`.

## Sequence

1. Open the PR with the changeset.
2. Run Stage 1 → append findings under `## Stage 1`. Resolve every `block`-severity finding before proceeding.
3. Run Stage 2 → append findings under `## Stage 2`. Resolve every `block`-severity finding.
4. Merge only when zero unresolved `block` findings remain across both stages.

Stages run **sequentially within the same PR cycle**. Do not collapse them into a single pass. Do not skip one because the other passed.

## `<finding>` XML schema

```xml
<finding id="F-001" stage="1" severity="warn">
  <area>Security</area>
  <description>Brief description of what was found</description>
  <evidence>packages/agent/src/routes/registry.ts:263 — non-null assertion on re-read</evidence>
  <resolution commit="abc1234">Fixed by adding explicit null guard before returning 404</resolution>
</finding>
```

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | `F-001`, `F-002`, … unique per PR. Continues numbering across both stages. |
| `stage` | yes | `"1"` or `"2"` |
| `severity` | yes | `block` (stops merge), `warn` (acknowledged in writing), `info` (record-only) |
| `<area>` | yes | `Security`, `Correctness`, `Performance`, `A11y`, `DX`, `Docs` |
| `<description>` | yes | One sentence — what was found |
| `<evidence>` | yes | `file:line` OR PR-comment URL |
| `<resolution commit="…">` | when resolved | Short SHA of the fix commit; child of `<finding>` |

## Scope

Stage 1 applies to every phase-closing PR. Stage 2 applies to every phase-closing PR. There is no other PR shape in the v1 cadence — if the project later admits hot-fix PRs (post-v1.0), they need their own entry in this protocol.

Phase 6's own closing PR is the **live test** of this protocol — its PR description contains the `## Stage 1` and `## Stage 2` sections this document defines (POLISH-05 self-referential validation).

## What this protocol does not do

- It does **not** build a `<finding>` aggregator service (D-6-14). The two skills already produce findings; the protocol is enforcement, not infrastructure.
- It does **not** automate finding-resolution. The author resolves each `block` finding with a fix commit and adds the `<resolution commit="…">` child manually.
- It does **not** gate the impeccable-critique CI check — that's a separate workflow (`.github/workflows/impeccable.yml`, D-6-09/D-6-09.v1).
