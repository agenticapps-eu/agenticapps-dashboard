# Remove the GitNexus integration from the dashboard

## Why

GitNexus is being removed from this product. Decided 2026-07-26 (GAP-04).

This is a **product decision, not a consequence of the workflow migration.**
Migration `0032` removed GitNexus from the AgenticApps workflow scaffold — the
reindex hook, the install scripts, the CLAUDE.md block. The tool itself remains
installed and registered as an MCP server and stays available outside the
dashboard. What is going away is the dashboard's *surface* over it: the scan
actions, the coverage column, and the schemas and UI that carry them.

The feature works today. It is being removed because the dashboard should not
carry a fleet-wide surface for a tool the fleet's workflow no longer provisions,
not because it is broken.

Two open defects (`family-scan-no-ui-feedback`, `per-row-scan-repo-not-registered`)
were previously staged as `fix-coverage-scan-open-defects`. That change is
**withdrawn** — the defects die with the code, and fixing them first would be
wasted work.

## What changes

- Delete the daemon scan library, routes, and scanner (~1,541 LOC product code,
  ~2,578 LOC tests across 18 files).
- Remove the code-graph column from the coverage matrix, its shared schema, and
  the SPA surfaces that render it.
- Recompute conformance history so the trend stays comparable across the change.
- Remove the vendored `.claude/skills/gitnexus/` from this repo.

## Capabilities

- `code-intelligence` — the code-graph half is removed; the knowledge-graph
  viewer half is untouched
- `fleet-coverage` — the matrix loses one column
- `fleet-conformance` — scoring denominator changes; history must stay comparable

## The history problem, and why it gets its own requirement

Conformance is an equal-weight score across the tracked coverage columns.
Dropping one changes every score. Because the 90-day trend is what surfaces slow
regressions, an uncorrected cutover would put a step in the chart that reads as a
change in fleet health but is really a change in measurement — and if code-graph
cells were mostly red across the fleet, that step is a **fake improvement**,
recorded permanently.

Daily snapshots store every per-column state inline, so historical days can be
re-scored over the reduced column set. History stays continuous. That is
specified below rather than left as an implementation note, because getting it
wrong silently corrupts the one signal the surface exists to provide.

## Non-goals

- Uninstalling GitNexus or removing its MCP server registration. The tool stays
  usable; only the dashboard's surface over it is removed.
- Touching the knowledge-graph viewer, its endpoints, or the Code Intelligence
  page's non-GitNexus content.
