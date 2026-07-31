# Show whether the four host workflows are in sync with the core spec

## Why

Five repos carry the AgenticApps workflow: `agenticapps-workflow-core` and the
four host implementations. Whether they agree is the question this fleet's actual
work turns on, and nothing in the dashboard answers it today.

A measurement on 2026-07-26 found two things that no surface would have shown:

- **All four hosts claim the same `implements_spec` in their primary skill, and
  three of the four are dragging laggard skills behind it.** A single number per
  host hides this completely. Only one host is drift-free.
- **No host recorded a vendor header naming the core commit its shared artefacts
  came from,** although a host spec requires it. The artefacts happened to be
  byte-identical to the core reference, so the fleet was green — but the
  evidence chain that would prove it stays green was missing.

The second finding matters because "byte-identical today" and "provably vendored"
are different guarantees, and the failure they guard against — a host that
hand-merges instead of vendoring — has occurred before.

**That second finding has since been fixed upstream, in a way this change did not
anticipate.** On 2026-07-31 `claude-workflow` stopped vendoring the shared
artefacts altogether (ADR-0047, its PR #109): `bin/openspec-change-gate.sh` and
`bin/reviewer-cli.sh` were deleted, and `install.sh` now resolves them from
`tools/core-vendor.manifest` — one `core_commit` plus a `sha256` per file —
at install time. That is a stronger guarantee than the vendor header this change
asked for, and the plan as first written scores it as the weakest possible
result: the reference host reads as *missing* two artefacts it deliberately no
longer carries. A conformance surface whose worst score lands on the host that
solved the problem is measuring the wrong thing, so the delta gains a third state
alongside vendored and absent.

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
2b. **Pin recognition.** A host that declares a pin manifest instead of vendoring
   is scored on pin integrity — one commit covering every entry, every published
   artefact listed, every recorded digest matching the reference bytes — and is
   not reported as missing the files it deliberately does not carry. The pin is
   verified against the reference, never taken on its own assertion. Vendoring
   remains fully conformant and is scored exactly as before; a vendoring host is
   not reported as deficient for not pinning.
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
argument vector, a fresh private scratch working directory, its own process group
with group-wide termination, memory/output/disk bounds, bounded concurrency, and
no execution on render. A harness must also be byte-identical to its core
reference before it can run. If those bounds cannot be held, the correct outcome
is to drop the harness block, not to loosen them.

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

The durable security text and `openspec/config.yaml` are updated together: the
registry route remains the ordinary mutation surface, while the explicitly
requested harness may write only its private daemon-owned result/scratch tree.
The fixed workflow repo names resolve beneath configured source-family roots;
configuration can relocate a family but cannot add a sixth repo or supply a
harness path.

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

## Review findings resolved in the planning artifacts

- The fleet is a fixed daemon-side set:
  `agenticapps-workflow-core`, `claude-workflow`, `codex-workflow`,
  `opencode-workflow`, and `pi-agentic-apps-workflow`. Requests cannot add a
  sixth root or change an artifact mapping.
- Intentional divergence remains visible. An upstream ADR may explain it, but an
  explanation does not make older bytes or versions conformant to current core.
- Expected skills come from each host repository's tracked skill set. Missing,
  duplicate, malformed, and non-semver declarations are explicit unknown or
  missing results, never silently skipped.
- Per-host machine-global skill directories join `~/.agenticapps/bin` as named
  read-only roots. The obsolete `~/.gitnexus` scanner root is removed in the
  same deployed cutover as `remove-gitnexus-integration`.
- The harness endpoint inherits bearer authentication and the origin lock. Its
  fixed commands run with exact time, memory, output, and concurrency bounds;
  cached output and scanner responses expose symbolic identifiers rather than
  absolute paths or captured credentials.
- The cache fingerprint includes the tested artifact, harness, core reference,
  and runner contract version. A completed failing result is cached; a timeout
  or bounded-out run is not.
- Vendor provenance is presence-and-syntax reporting in this change. Resolving
  arbitrary historical commits would require a new git-read capability and is
  deliberately not claimed.
