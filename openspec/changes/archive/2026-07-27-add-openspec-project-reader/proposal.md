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
| Per-change recency | nothing — artifact mtimes | `lastModified` per change, given |
| Completed history | phase dirs that do not sort | `changes/archive/` date-prefixed, sorts by construction |
| **What the project promises** | **nothing — you would read 21 phases in order** | `specs/` — capabilities with requirement counts |

The project's last-commit timestamp is **not** in that table and does not change:
it stays git-derived, per `Per-Project Computed Status`. The per-change
`lastModified` row records what the format makes available, not a field this
change renders — no requirement or task consumes it. It is listed because it is
part of why the format is better to read, and flagged here so a later change
adding a per-change recency display knows the value is already there for free.

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
- A new coverage-matrix column for OpenSpec. The non-goal stands, but **not** for
  the reason first given. The original justification — that `workflowVersion >=
  3.0.0` already implies the OpenSpec layout — is false, and `claude-workflow`
  refutes it: it ships 3.0.0 with no `openspec/` directory. The real reason is
  that v2 withdraws the coverage matrix entirely, so there is no column to add.
  Recorded as finding 1 below and in the `CAPABILITY-MAP.md` errata.

## Review findings, 2026-07-26 — resolved

Three reviewers (`gemini`, `codex`, `opencode`) returned REQUEST-CHANGES; see
`REVIEWS.md`. Twelve distinct findings, resolved below. Six of them changed the
spec delta; the design decisions behind them are in `design.md`.

An earlier revision of this section recorded five findings as "not yet resolved"
because this change was foreign scope to the session that reviewed it. That
consolidation also undercounted — codex raised eight and opencode ten, against
the five carried forward.

| # | Finding | Resolution |
|---|---|---|
| 1 | `workflowVersion >= 3.0.0` does not imply OpenSpec — `claude-workflow` ships 3.0.0 with no `openspec/` | Premise removed from the non-goal below; errata already appended to `CAPABILITY-MAP.md` |
| 2 | The `openspec` binary is an unspecified spawning surface | New requirement `OpenSpec CLI Invocation Discipline` in `filesystem-access-policy` — resolve-once, fixed argv table, project root as the only request-derived value, bounded, always falls back. Supplies the discipline `add-workflow-fleet-conformance` already names as spawn site 3 |
| 3 | Auto-discovery contradicts the install hint | `Registry CRUD Surface` MODIFIED in place rather than a parallel requirement; `.planning/config.json` dropped as a marker, existing registrations untouched |
| 4 | A GSD-only repo is told to install a workflow it has | Status now distinguishes `migrated` / `needs-migration` / `no-workflow`; the card renders a migration hint for the middle one |
| 5 | Mid-migration repos with both trees have no stated precedence | Scenario added: `openspec/` wins, nothing is read from `.planning/phases/` |
| 6 | "Both paths MUST produce the same values" is unenforceable | Pinned to a field table, scoped to conformant change directories, CLI preferred where they diverge. Round 2 reduced the table to five fields — see finding 13 |
| 7 | CLI cannot distinguish a missing task artifact from an empty one | Task-artifact presence is now its own reported value, not inferred from a zero count |
| 8 | Archive ordering has no pinned format | Pinned to a zero-padded ISO `YYYY-MM-DD-` prefix; non-matching directories sort last with no chronological claim |
| 9 | Affected-capability derivation undefined | Derived from `specs/<capability>/` directory names, always from the tree; scenario added for a change with no spec delta |
| 10 | No empty state for "no open changes at all" | Scenario added |
| 11 | Card requires review finding counts whose source this change deletes | Field removed from the card. `REVIEWS.md` is prose with no structured severity; a count would be a regex over English |
| 12 | `.planning` stays allow-listed with no stated reason | Named: `.planning/skill-observations/` is read by the override-sentinel scanner and the commitment route, and `.planning/config.json` is live lifecycle config. Only `.planning/phases/` stops being read |

Two further findings were decided rather than applied, with reasoning in
`design.md`:

- **Exposing `openspec/` through `/read`** — the reviewers split, one calling it
  an exposure and one finding no regression. **Accepted explicitly**, on the
  ground that it is the same content class as `.planning/`, allow-listed since
  the first release under unchanged route bounds.
- **A GSD fallback behind a flag** — **declined.** This is a ratified decision
  (GAP-05, and the accepted consequence below), not an open question. The blank
  column is the intended signal; a fallback would hide the migration backlog.

One finding was raised by neither reviewer and found while applying these: the
`Named Allowed Roots For Fleet Scanners` scenario named `~/.gitnexus` as an
example root, which `remove-gitnexus-integration` deletes. Restated generically.

## Review round 2, 2026-07-26 — resolved

The revised change was re-reviewed (`gemini`, `opencode`; `codex` was
unavailable). Both returned REQUEST-CHANGES with thirteen further findings,
several of them against text written in round 1. All are resolved.

Two were settled by measurement rather than argument, which is why they were
taken first — either could have invalidated the design:

- **The CLI argv table was an unverified assumption.** If `openspec` did not
  expose `list --json`, the hybrid rationale collapsed to tree-only. Verified
  against **openspec 1.6.0**: both forms exist and return exactly the fields the
  parity set names. The version is now recorded in the spec.
- **Archive prefix pinning risked inverting legacy history.** If the 21 archived
  GSD-era directories did not carry ISO prefixes, the "non-matching sorts last"
  rule would have pushed the entire legacy archive *after* new changes. Measured:
  all 21 conform. The rule is defensive, displacing nothing.

| # | Finding | Resolution |
|---|---|---|
| 13 | Parity table listed task-artifact presence, which the CLI cannot produce — the claim was unachievable | Presence moved to the always-from-tree set alongside archive and affected capabilities; parity is now five fields, and presence has one source on both paths |
| 14 | Spawn failure absent from the fallback list — a binary resolved at start then deleted raises neither non-zero exit nor any listed case | Spawn failure added to the fallback conditions, with a scenario |
| 15 | Shape-recognition strictness undefined; an exact-set check would degrade to the tree on every upstream field addition | Pinned to a required-subset check that ignores unknown fields, with scenarios in both directions |
| 16 | Version skew only half-handled — an *older* CLI missing a consumed field would misreport | Same required-subset rule: a missing consumed field is unrecognised and falls back, rather than reporting a partial project |
| 17 | No scenario for a binary that is a directory, a broken symlink, or non-executable | Folded into resolution failure explicitly, with the scenario extended |
| 18 | `/read` has no size limit — an oversized file in any allow-listed directory is a DoS vector | Size cap added to `Per-Project Path Allow-List`, with a scenario. Pre-dates `openspec/` and applies to all three directories equally |
| 19 | "Same content class as `.planning/`" was asserted, not argued | Replaced with a category-by-category comparison — plans, review artifacts, security artifacts, research notes — including that `.planning` already carried multi-AI review output under ADR-0018 |
| 20 | What counts as an open change was undefined | Minimal invariant added: any non-dot directory under `changes/` other than `archive/`, deliberately permissive, CLI authoritative on the CLI path |
| 21 | "Reported as having no task data" could be read as omitting the change | Stated explicitly: the change is still listed, with a no-task-list state replacing its ratio |
| 22 | The single-project view for a `needs-migration` project was undefined | Scenario added — an informational migration state, with header context still rendering |
| 23 | Motivation table implied last-activity stopped being git-derived | Corrected: the project's last-commit timestamp stays git-derived; the row now describes per-change recency |

Round 1's reviews are preserved in this change's git history; `REVIEWS.md`
carries round 2.
