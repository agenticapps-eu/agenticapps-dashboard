# Read OpenSpec projects, not just GSD phase trees

## Why

The dashboard's core value is reading a project's planning state and rendering
it. Every reader it has parses the GSD layout: `.planning/phases/<N>/` for phase
progress, `.planning/config.json` as the auto-discovery marker, the phase
artifact checklist, the phase-number-to-status mapping.

The fleet is migrating that layout away. Workflow v3.0.0 (migration `0032`)
replaces the GSD phase engine with OpenSpec: current truth lives in
`openspec/specs/`, in-flight work in `openspec/changes/`, finished work in
`openspec/changes/archive/`. A project that has migrated has no
`.planning/phases/` for the dashboard to read.

This is not hypothetical. **This repository migrated first.** Its own planning
history now lives at `docs/legacy-planning/`, so the dashboard cannot currently
read its own project row — it reports itself as having no workflow installed.
Every other repo in the fleet will land in the same state as it migrates.

Recorded as GAP-05 during the OpenSpec migration and deliberately staged rather
than fixed in that PR, because it is a product change requiring a real planning
cycle, not a mechanical migration step.

## What changes

- Detect which planning front end a registered project uses, rather than
  assuming GSD.
- Read progress from `openspec/changes/` and `openspec/changes/archive/` for
  OpenSpec projects, mapping it onto the existing progress projection.
- Extend auto-discovery to recognise an `openspec/` directory as a valid marker.
- Recognise a relocated legacy planning tree so migrated projects keep their
  history visible rather than appearing to have none.
- Decide what the fleet-coverage workflow-version column means once the fleet is
  past 3.0.0.

## Capabilities

- `project-dashboard` — progress projection gains an OpenSpec source
- `project-registry` — detection and auto-discovery gain an OpenSpec marker

## Non-goals

- Removing the GSD readers. Most of the fleet has not migrated yet, and
  `docs/legacy-planning/` trees remain readable. Both must work simultaneously
  for the whole transition.
- Rewriting `fleet-coverage`'s column set. Whether a new column is needed is an
  open question below, not a decision this change makes.

## Open questions

> [GAP: What does "current phase" mean for an OpenSpec project? There is no
> phase number. Candidates: the count of active changes, the most recently
> modified active change, or dropping the notion entirely and showing
> "N changes open". This decides the home card's primary line and needs a
> product call.]

> [GAP: Should `fleet-coverage` gain an `openspec` column, or should the existing
> `workflowVersion` column simply read 3.0.0-and-above as "OpenSpec"? A new
> column costs matrix width on a surface that is already dense.]

> [GAP: Should the daemon read a migrated project's `docs/legacy-planning/` at
> all? The path allow-list in `filesystem-access-policy` currently permits only
> `.planning/` and `.claude/`. Reading it would require widening that allow-list,
> which is a security-spine change and must not be done casually.]
