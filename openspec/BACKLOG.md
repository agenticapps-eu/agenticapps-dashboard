# Backlog — work that is not a spec change

An OpenSpec change must carry a spec delta. Some real, tracked work has no
product-behaviour delta at all — it is process debt. That work is recorded here
so it is not lost between the phase tree and the change list.

Carried in from `docs/legacy-planning/STATE.md` §"Deferred Items" during the
OpenSpec migration (2026-07-26).

## Human verification backlog

**Status: ✅ RETIRED 2026-07-26 by explicit decision.** All 10 `human_needed`
verifications and the residual UAT statuses are closed, not carried forward a
third time.

**The decision and its reasoning:** the phases below shipped in May 2026 and have
been in continuous production use since. Sustained real-world use is stronger
evidence than a retrospective sign-off performed months later by someone
reconstructing what the phase did. Re-running the ritual would have produced
paperwork, not information. The gate is therefore recorded as *superseded by
production use* for these specific phases — not waived, and not silently dropped.

This does **not** relax the gate going forward. New work still verifies before it
ships; this closes inherited debt from before the OpenSpec migration.

**Still to do:** update `docs/legacy-planning/STATE.md` §"Deferred Items" to
record the retirement, so a future audit does not re-open it. That file is
read-only history, so the note belongs alongside it rather than edited into it —
this entry is that record.

---

*Original entry, retained for provenance:*

Carried forward at both the v1.1 close (2026-06-08) and the v1.2 close
(2026-06-14) under proceed-and-acknowledge.

The v1.2 open-artifact audit found 22 items, all inherited from already-shipped
v1.0/v1.1 phases — none from v1.2 or Phase 8:

| Category | Detail | Status |
|---|---|---|
| verification | `VERIFICATION.md` for phases 00, 01, 02, 03, 04, 06, 05.1, 10, 11.1, 11.2 | `human_needed` (10 items) |
| uat | Phase 01 `HUMAN-UAT.md` | 2 genuinely-open scenarios |
| uat | Phases 03, 05, 07, 13, 05.1, 10, 11, 11.1 | partial/closed/resolved — 0 pending |

The implementations shipped and have been in production use since. What is
missing is the human confirmation, which is precisely the part that cannot be
delegated to an agent.

> This was briefly staged as an OpenSpec change during the migration and then
> withdrawn: it has no spec delta, and `openspec validate` correctly refuses a
> change without one. Process debt belongs here, not in `openspec/changes/`.

## Known stale artifact — ✅ RESOLVED 2026-07-26

`.claude/claude-md/workflow.md`, the GSD-era vendored workflow document, has been
**removed**. `CLAUDE.md` points at `docs/WORKFLOW.md` (workflow v3.0.0).

Removing it required a matching hook change. `normalize-claude-md.sh` treated the
file's *presence* as the signal to collapse CLAUDE.md's Workflow section, and its
*absence* as a reason to inject a `"Workflow defaults. Migration 0009 not yet
applied."` stub. Deleting the file alone would therefore have written a false and
stale notice into `CLAUDE.md` on the next PostToolUse fire. The hook now always
collapses, since `docs/WORKFLOW.md` is canonical. Verified: a hook run leaves
`CLAUDE.md` byte-identical.

**Side benefit.** That vendored copy carried its own 13-flag red-flag list under a
reworded heading, with four flags reworded from the canonical wording — the §04
divergence documented in `.claude/skills/agentic-apps-workflow/SKILL.md`. Since
that copy was "what agents read at runtime", removing it means agents in this repo
now read only the canonical list.

`SKILL.md` still describes that divergence in its §04 discussion. Left as-is
deliberately: it is a vendored file synced from the scaffolder, so editing it here
would create drift and be reverted on the next `/update-agenticapps-workflow`. The
statement remains true of freshly scaffolded projects generally — just no longer
of this one.

## Impeccable floor: three numbers on disk, and a CI gate that does not exist

Found 2026-07-26 while merging the Dashboard v2 plan into this slot. No spec
delta — the composite floor is process, not product (see *Deliberate exclusions*
in `CAPABILITY-MAP.md` and the preamble of `openspec/specs/design-system/spec.md`).
It belongs here.

**Three different floors are recorded in this repo:**

| Source | Value |
|---|---|
| `CLAUDE.md:144` — ratified 2026-06-08 | **≥ 80** ← current truth |
| `CAPABILITY-MAP.md` traceability note | records 87 → 80 via D-10.5-03 |
| `README.md:57`, `README.md:107` | ≥ 87, plus "v1.1 commits to lifting the floor to ≥ 90" |
| `docs/spec/dashboard-prompt.md:554,594,696` | ≥ 87, "calibration pending" |

`README.md` is stale: it states a floor superseded in June 2026.
`dashboard-prompt.md` is historical reference material and correctly frozen —
it is not a defect there.

**The CI gate does not exist.** `README.md:57` and `README.md:107`, and
`docs/review-protocol.md:63`, all reference `.github/workflows/impeccable.yml`.
The workflows directory contains only `ci.yml` and `release.yml`. This is not an
accidental deletion: `dashboard-prompt.md:554` records that "Phase 6's CI gate
retired in favor of the per-phase artifact". The links were never updated when it
was retired.

**Consequence for the v2 plan.** Linear AGE-476 reads "the CI gate threshold
rises from ≥ 87 to ≥ 90". Both halves are wrong against the repo: the baseline is
80, and there is no CI gate to raise. The intent — hold a higher bar for the
rebuilt surfaces — is sound and unaffected.

**To do, with AGE-476:**

- Correct `README.md` to the ratified floor, and either remove the dead workflow
  links or restore an actual CI gate.
- Correct `docs/review-protocol.md:63` the same way.
- Decide explicitly whether the raised floor is enforced in CI or stays a
  per-change artifact gate. It is currently the latter, and the docs claim the
  former.
