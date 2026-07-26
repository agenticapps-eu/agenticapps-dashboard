# See what the agents are doing, on a screen that is not a terminal

## Why

Three agent hosts run sessions on this machine, each writing its own task state
in its own format. A terminal viewer already reads all three, normalises them,
and renders them — but only at the terminal.

The founding use case for this dashboard is a second device: open it on an iPad
and look at the fleet. Agent activity is the thing most worth looking at from
across the room, and it is the one thing the dashboard cannot show.

Linear: AGE-470, AGE-471, AGE-472. Design basis:
`docs/spec/DASHBOARD-V2-SPEC.md` §7.

## What changes

1. **A normalised board endpoint** returning sessions and tasks across the three
   hosts in one shape.
2. **A shared adapter package.** The existing adapters move into their own
   package in the viewer's repo and both frontends import it. They are not
   copied.
3. **A board surface**: four columns, one card per task, host identity carried by
   the same colour system the terminal viewer already uses, read-only.

## Capabilities

- `agent-board` (new)

## Two stages, so two pieces of work do not block each other

The endpoint ships first against a stub. The adapter extraction is a change in
another repo with its own review; the board surface is work in this one. Neither
needs the other to make progress, and coupling them would stall both.

The wire shape is fixed from the start, so the swap from stub to real adapters
changes no consumer.

## What this change explicitly does not do

- **It does not rewrite or copy the adapters.** They are the expensive part —
  three error layers in one, nine fixture cases including a truncated final line
  and a duplicated update in another, a SQLite read with a legacy JSON fallback
  in the third, all verified against real files. Two copies drift, and the copy
  living here would not inherit the fixtures. A relative-path import across repo
  boundaries is also rejected: it breaks the repos' self-containment.
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

## Open questions

> [GAP: The done column is bounded to a recent window so it does not overflow.
> The window length is a product judgement, not a derived value, and no usage
> data exists yet. Recommended: ship the design spec's proposal and revisit once
> the board has been used across a few working days.]
