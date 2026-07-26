# Show whether the four host workflows are in sync with the core spec

## Why

Five repos carry the AgenticApps workflow: `agenticapps-workflow-core` and the
four host implementations. Whether they agree is the question this fleet's actual
work turns on, and nothing in the dashboard answers it today.

A measurement on 2026-07-26 found two things that no surface would have shown:

- **All four hosts claim the same `implements_spec` in their primary skill, and
  three of the four are dragging laggard skills behind it.** A single number per
  host hides this completely. Only one host is drift-free.
- **No host records a vendor header naming the core commit its shared artefacts
  came from,** although a host spec requires it. The artefacts happen to be
  byte-identical to the core reference right now, so the fleet is green — but the
  evidence chain that would prove it stays green is missing.

The second finding matters because "byte-identical today" and "provably vendored"
are different guarantees, and the failure they guard against — a host that
hand-merges instead of vendoring — has occurred before.

This change adds a surface that would have shown both without anyone looking for
them.

Linear: AGE-467, AGE-468, AGE-469. Design basis:
`docs/spec/DASHBOARD-V2-SPEC.md` §6.

## What changes

1. **A workflow scanner** over the five workflow repos, reading core spec
   versions, per-skill `implements_spec`, the shared artefacts' version markers,
   byte identity against the core reference implementations, highest applied
   migration, and what is installed machine-wide.
2. **A version matrix** with two blocks: spec conformance (primary skill, the
   range across all skills, named laggards) and shared artefacts (byte identity,
   vendor-header presence, machine-wide install).
3. **An on-demand conformance harness runner** with an aged, content-invalidated
   cache.
4. **A scoped second execution exception** in the security spine, because item 3
   requires one.

## Capabilities

- `workflow-fleet-conformance` (new)
- `filesystem-access-policy` — **modified**: a second, tightly-bounded execution
  exception and a machine-wide allowed root

## The security-spine change, stated plainly

`filesystem-access-policy` currently reads: *"The sole exception is
`POST /api/projects/{id}/open`, which spawns `$EDITOR`."* The same sentence is a
hard constraint in `openspec/config.yaml`.

The harness runner breaks it. It executes shell scripts that this repo does not
own, from other repos, on the user's machine. That is a genuine widening of the
product's most load-bearing guarantee, and it is written as a spec delta rather
than left as a note in a security document — because a constraint that says
"sole exception" while a second exception ships is worse than a constraint that
names both.

The exception is bounded, and every bound is a requirement rather than a note:
canonical-path resolution under a fixed daemon-side root list with re-validation
at spawn time, a fixed internal command table so no request value reaches an
argument vector, a scratch working directory, its own process group with
group-wide termination, CPU/memory/output bounds, bounded concurrency, and no
execution on render. If those bounds cannot be held, the correct outcome is to
drop the harness block, not to loosen them.

**What the daemon does not promise.** An earlier draft asserted that every
registered project's working tree stays byte-identical across a harness run.
Three reviewers independently rejected it, correctly: the daemon does not control
the script, so it cannot enforce what the script touches. The spine now states
only what is enforceable at the spawn boundary — which program, which arguments,
which working directory, which limits, and how it dies. Weaker on paper, and true.

**Rate limiting.** `packages/agent/src/lib/rateLimiter.ts` exists in the daemon,
but nothing in `openspec/specs/` specifies it. Rather than delegate a bound to a
component the spec slot does not know about, bounded concurrency is written into
the harness requirement directly. Specifying the general limiter is separate work.

`~/.agenticapps/bin` is added as a named allowed root for the scanner. It is
read-only and it is the path that decides what the agents actually execute, which
is why the surface exists.

## What this change explicitly does not do

- **It does not fix any of the findings it surfaces.** The laggard skills and the
  missing vendor headers live in the host repos and the core spec. They are
  tracked as AGE-478 and AGE-477 and belong upstream, not here. This change makes
  them visible; it does not repair them.
- **It does not hardcode measured values.** No requirement below names a version
  number. Requirements specify the *comparison* — maximum across sections, range
  across skills, byte equality against the reference — so the spec does not carry
  a measurement that goes stale the next time anyone vendors anything.
- **It does not add a migration ledger.** That is the clean answer to "is this
  host current", and it belongs in the core spec and the four installers, not in
  a dashboard that can only read what already exists.
- **It does not run the harness automatically.** The harness builds fixture
  repos and stubs a CLI on the path. It costs seconds, times four hosts. A render
  must never trigger it.
- **It does not write to any workflow repo.** The scanner reads; the harness runs
  scripts that manage their own temporary fixtures.

## Resolved: the cache is keyed on both the artefact and the harness

An earlier draft shipped this as an open question. All three reviewers rejected
that, and they were right — it was a known defect wearing an open question's
clothing, and it contradicted this change's own rejection of age-only caching.
Resolved: the cache key covers the artefact under test **and** the harness script,
and either changing discards the result.
