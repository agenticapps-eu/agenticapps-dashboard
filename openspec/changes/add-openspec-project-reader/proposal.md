# Read OpenSpec projects, and retire the GSD reader

## Why

The dashboard's core value is reading a project's planning state and rendering
it. Every reader it has parses the GSD layout: `.planning/phases/<N>/` for phase
progress, `.planning/config.json` as an auto-discovery marker, artifact presence
as a progress proxy.

The fleet has moved. Workflow v3.0.0 replaces the phase engine with OpenSpec, and
the replacement format is **strictly better to read**:

| The card needs | GSD gives | OpenSpec gives |
|---|---|---|
| Current work | `findCurrentPhase()` — readdir plus a "highest-numbered" sort over names like `00-bootstrap`, `DASH-05.1-…`, `DASH-10.5-…`, `13-…` | change names and status, enumerable |
| Progress | artifact-presence heuristic (CONTEXT ✓, PLAN ✓ …) | `completedTasks / totalTasks` — a real count |
| Last activity | a git subprocess | `lastModified`, given |
| Completed history | phase dirs that do not sort | `changes/archive/` date-prefixed, sorts by construction |
| **What the project promises** | **nothing — you would read 21 phases in order** | `specs/` — capabilities with requirement counts |

That last row is why this change also adds a surface the dashboard has never
had. The GSD tree contained no representation of current truth, so the dashboard
could only ever show *activity*. It can now show *state*.

The phase-sort fragility is not theoretical: the migration's own archive script
needed a hand-maintained date table because those directory names cannot be
ordered programmatically.

## What changes

1. **Read the OpenSpec layout.** Hybrid strategy — use the `openspec` CLI's JSON
   output when the binary is available, fall back to reading the tree directly
   when it is not. The archive is read from the tree in both cases; the CLI does
   not expose it.
2. **Add a capability panel.** Render `specs/` as the project's current promise:
   capabilities and their requirement counts.
3. **Replace the phase concept on the card.** Open change count plus per-change
   task ratios, rather than a synthesised "current phase".
4. **Retire the GSD reader.** `.planning/phases/` parsing is removed.
5. **Widen the allow-list by one entry** — `openspec`, alongside `.planning` and
   `.claude`.

## Capabilities

- `project-dashboard` — progress projection moves to OpenSpec; capability panel added
- `project-registry` — detection, auto-discovery, and status move to OpenSpec
- `filesystem-access-policy` — one new allow-listed top-level directory

## Accepted consequence: 8 repos go blank

Retiring the GSD reader was chosen deliberately over gating it on fleet
migration. At the time of writing, 8 registered-or-scannable repos are GSD-only
and will render no progress data until each migrates:

`agenticapps-roadmap`, `agents-task-viewer`, `claude-workflow`,
`pi-agentic-apps-workflow`, `workflow-testbed`, `factiv/cparx`,
`factiv/stimmung`, `neuroflash/mcp-server`

This includes the flagship product (`cparx`) and the workflow repo itself
(`claude-workflow`). This is recorded as an accepted cost, not an oversight —
the remedy is to migrate those repos, and dual-path readers were judged not
worth carrying.

## Non-goals

- Reading relocated `docs/legacy-planning/` trees. That would widen the
  allow-list into `docs/`, which holds unrelated content, for history already
  archived in `openspec/changes/archive/`. Explicitly rejected.
- A new coverage-matrix column for OpenSpec. ⚠ **The original justification for
  this non-goal was false — see the review findings below.** The non-goal itself
  stands, but for a different reason: v2 withdraws the coverage matrix entirely,
  so there is no column to add.

## Review findings, 2026-07-26 — recorded, not yet resolved

Three reviewers (`gemini`, `codex`, `opencode`) returned REQUEST-CHANGES; see
`REVIEWS.md`. The following were verified against the repo and are carried here
so the next editor of this change does not have to rediscover them. **None is
fixed yet.**

1. **`workflowVersion >= 3.0.0` does not imply OpenSpec.** This premise appears
   in the non-goal above and in `CAPABILITY-MAP.md` GAP-05. Counterexample,
   measured: `claude-workflow` ships `version: 3.0.0` and has no `openspec/`
   directory. The repo that publishes 3.0.0 refutes it. Corrected in the
   capability map's appended errata.

2. **The `openspec` binary is a new process-spawning surface, unspecified.** The
   hybrid read strategy invokes a binary resolved from `PATH`. The security spine
   scopes the git subprocess with a command allow-list and now enumerates every
   spawning site; this one needs the same treatment — how the binary is located,
   argv rather than shell, and which user-controlled values reach it.
   `add-workflow-fleet-conformance` already lists it as spawn site 3, so the
   enumeration is consistent; the argv discipline is still missing here.

3. **Auto-discovery contradicts the install hint.** The change adds `openspec/`
   as a discovery marker but leaves the existing auto-discovery scenario naming
   the workflow-skill and `.planning/config.json` markers. A GSD-only repo stays
   registrable through the old marker, then its card tells the user to install a
   workflow that is already installed. Modify the existing requirement rather
   than adding a parallel one.

4. **Archive ordering has no pinned format.** "Ordered by their date prefix" is
   only sortable lexicographically if the prefix is zero-padded ISO. This change
   elsewhere argues that GSD directory names could not be ordered
   programmatically — the replacement should not inherit the same weakness by
   omission.

5. **`.planning` stays allow-listed with no stated reason.** The GSD reader is
   retired but the allow-list entry remains. Whatever still reads it should be
   named, so a later cleanup does not remove something load-bearing.
