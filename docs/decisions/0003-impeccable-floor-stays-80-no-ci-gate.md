# ADR-0003: The impeccable floor stays ≥ 80, enforced by artifact, not CI

**Status**: Accepted  **Date**: 2026-08-05  **Linear**: AGE-476

## Context

Four documents in this repo recorded four different design-critique floors, and
three of them pointed at a CI workflow that does not exist:

| Source | Value |
|---|---|
| `CLAUDE.md` — ratified 2026-06-08 | **≥ 80** ← current truth |
| `openspec/CAPABILITY-MAP.md` | records 87 → 80 via D-10.5-03 |
| `README.md` (FAQ 9, CI section) | ≥ 87, plus "v1.1 commits to lifting the floor to ≥ 90" |
| `docs/spec/dashboard-prompt.md` | ≥ 87, "calibration pending" |

`README.md:65`, `README.md:121` and `docs/review-protocol.md:63` all linked
`.github/workflows/impeccable.yml`. That workflow does not exist and its absence
is not accidental — `dashboard-prompt.md:554` records that "Phase 6's CI gate
retired in favor of the per-phase artifact". The links were never updated when
it was retired, so the docs claimed an enforcement mechanism the repo had
deliberately removed, and went on claiming it from June to August 2026.

Linear AGE-476 then asked that "the CI gate threshold rises from ≥ 87 to ≥ 90".
Both premises are false against the repo: the ratified baseline is 80, not 87,
and there is no CI gate to raise. The *intent* — hold a higher bar for the
rebuilt v2 surfaces — is sound and survives this decision.

## Decision

**The floor stays ≥ 80**, with the existing structural-debt waiver clause. The
AGE-476 threshold clause is void because the numbers it reasons from were wrong;
raising a ratified floor is its own ratification, not a side effect of a ticket
whose premises did not hold.

**Enforcement remains a per-change artifact gate.** Every frontend-touching
change runs `impeccable:critique` at 1440×900 and commits the artifact —
composite, per-heuristic scores, findings, persona red flags — into its change
directory, where a reviewer reads it. `CLAUDE.md` is the single normative
statement of both the floor and the mechanism.

Dead `impeccable.yml` links removed from `README.md` and
`docs/review-protocol.md`; both now state that the floor is not a CI check.
`docs/spec/dashboard-prompt.md` keeps its ≥ 87 — it is frozen historical
reference material and correct as a record of what was true then.

## Alternatives Rejected

**Raise to ≥ 90 repo-wide, as AGE-476 literally says.** A 10-point jump on a
floor ratified two months earlier, applied to surfaces this change does not
touch, would force structural-debt waivers on unrelated routes — turning the
waiver from an escape hatch into the normal path, which is how a floor stops
meaning anything.

**Two-tier: 80 repo-wide, 85 for the surfaces rebuilt under AGE-476.** Honours
the ticket's intent most precisely, and was the leading option. Rejected because
a second floor needs its own ratification and its own definition of which
surfaces are "rebuilt" — real work, and not what this bullet is. Left open as a
future decision.

**Restore an actual CI workflow so the docs become true.** The composite is an
LLM-driven heuristic score produced by a skill driving a real browser, not a
deterministic CLI: `impeccable --json` is a no-op that prints `[]` and exits 0,
the real scan is `impeccable detect --json`, and the 1440×900 viewport the floor
is defined at needs CDP-level control. A CI gate is therefore not mechanizable
today without first building a headless critique runner. Rejected as far larger
than the bullet, not as undesirable in principle.

## Consequences

- The four-numbers problem collapses to one normative source: `CLAUDE.md`.
- Nothing mechanical enforces the design floor. A frontend change that skips the
  critique artifact is caught by a reviewer noticing, or not at all — the same
  class of exposure as the §18 change-gate's reported-not-enforced reviews.
- No doc claims a CI gate that does not exist, so the next reader will not plan
  against one.
- A guard test asserting that every `.github/workflows/*.yml` path referenced in
  docs actually exists would have caught this in June. Not built here (out of
  scope for this bullet); recorded as a follow-up.
- Lifting the floor for rebuilt surfaces remains available and now needs an
  explicit ratification rather than an inherited ticket clause.
