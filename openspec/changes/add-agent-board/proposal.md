# See what the agents are doing, on a screen that is not a terminal

## Why

Four agent hosts run sessions on this machine, each writing its own task state
in its own format. A terminal viewer already reads all four, normalises them,
and renders them — but only at the terminal.

The founding use case for this dashboard is a second device: open it on an iPad
and look at the fleet. Agent activity is the thing most worth looking at from
across the room, and it is the one thing the dashboard cannot show.

Linear: AGE-470, AGE-471, AGE-472. Design basis:
`docs/spec/DASHBOARD-V2-SPEC.md` §7.

## What changes

1. **A normalised board endpoint** returning sessions and tasks across the four
   hosts in one shape.
2. **An external adapter package.** The existing adapters move into their own
   package in the viewer's repo and both frontends import it. The frozen model,
   parsing behavior, and fixture corpus stay shared. Bun-only runtime seams are
   made portable so the package works in both the Bun viewer and Node 20 daemon
   without a native dependency.
3. **A board surface**: four columns, one card per task, host identity carried by
   the same colour system the terminal viewer already uses, read-only, with
   session/flat grouping plus host and active-session filters.

## Capabilities

- `agent-board` (new)

## Two stages, so two pieces of work do not block each other

The endpoint and neutral fixture-backed surface can progress first. The adapter
extraction is owned by a separately reviewed change in the viewer repo; this
change consumes its released package but does not claim or archive that repo's
work. Live data and shared host colours cannot complete until that package is
available.

The envelope and record shapes are fixed from the start, so the swap from stub
to real adapters changes no consumer. The swap is whole-snapshot: a response is
either synthetic or observed and never combines the two.

The dashboard's internal shared schema package owns the strict runtime wire validator,
including a temporary Stage 1 mirror of the frozen record fields. Once the
adapter package is available, compile-time model checks and its fixture corpus
keep that validator aligned; host parsing remains exclusively upstream.

## What this change explicitly does not do

- **It does not copy or behaviorally redesign the adapters.** They are the expensive part —
  three error layers in one, nine fixture cases including a truncated final line
  and a duplicated update in another, a SQLite read with a legacy JSON fallback
  in the third, all verified against real files. Two copies drift, and the copy
  living here would not inherit the fixtures. A relative-path import across repo
  boundaries is also rejected: it breaks the repos' self-containment. Runtime
  calls such as `Bun.file`, `Bun.JSONL`, and `bun:sqlite` are seams, not the data
   model; they may be replaced behind the same fixtures to support Node 20. The
   extracted package includes the current `claude`, `codex`, `opencode`, and
   `pi` adapters and host-style definitions.
- **It does not change the data model.** The identifiers are frozen upstream by
  explicit instruction. The extraction moves files; it renames nothing.
- **It does not replace the terminal viewer.** Two frontends, one data model, one
  colour system. The terminal is faster at the terminal; the board is for the
  second device.
- **It does not write.** No drag-and-drop, no status change, no task creation.
  The viewer's philosophy is observation, not control — and a dashboard that
  writes into running agent sessions is a different security conversation than
  the one this product has had.
- **It does not add push.** No server-sent events, no websockets. That would
  contradict the existing no-push architecture, and polling is sufficient for a
  surface someone glances at.

## Resolved: exact freshness and display bounds

The completed window is 24 hours. Visible clients poll every three seconds, and
the daemon coalesces host reads behind a cache no older than one second. A change
is measured from the first poll eligible to observe it and has a five-second
visibility target, leaving time for request and render work. A failed refresh
keeps the last snapshot visible as stale; a hidden tab keeps it visible as
paused. Neither clears the board and implies that no tasks exist.

## Impact

The upstream viewer package layout changes, its adapters gain a portable runtime
boundary, and this repository gains one authenticated GET endpoint plus a
read-only SPA surface with bounded records and text fields. No host model
identifier changes, no native daemon dependency is introduced, and no process
is spawned.
