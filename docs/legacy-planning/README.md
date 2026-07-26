# Legacy planning archive (read-only)

This tree is the project's **GSD-era planning history**, preserved verbatim when
the repo migrated to the OpenSpec front end (workflow v3.0.0, migration 0032).

It was moved here by `git mv .planning docs/legacy-planning` — nothing was
deleted, rewritten, or summarised. Every phase folder, milestone archive,
requirement traceability table, audit, and decision log is exactly as it was.

## Do not edit

This is a backup and an evidence trail, not a live surface. Planning now happens
in `openspec/`:

| Was | Is now |
|---|---|
| `docs/legacy-planning/ROADMAP.md` (phases) | `openspec/changes/` (active), `openspec/changes/archive/` (done) |
| `docs/legacy-planning/phases/<slug>/` | `openspec/changes/archive/<date>-<slug>/` |
| current product truth, spread across phases | `openspec/specs/<capability>/spec.md` |

`openspec/specs/` is **current truth, post-supersession**. Where a later phase
overrode an earlier one, only the final state is in the spec — this tree is
where you go to find out *how* it got there.

## What stayed behind

`.planning/config.json` is **not** here. It is live workflow configuration (the
§17 `lifecycle` block, `front_end: openspec`), not history, so it remains at
`.planning/config.json` where the tooling reads it.

`.planning/skill-observations/` also stayed — it is gitignored local session
telemetry with no tracked files and no planning value. Moving it would have
un-ignored it, since the ignore rule is anchored to `.planning/`.

## Provenance

- Migration: `0032-bind-openspec-v1` (workflow 2.9.0 → 3.0.0)
- Adoption ADR: `claude-workflow/docs/decisions/0044-openspec-superpowers-adoption.md`
- Lifecycle: `docs/WORKFLOW.md`
