# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- spec-source: agenticapps-workflow-core@0.4.0 §11 -->
## Coding Discipline (NON-NEGOTIABLE)

These four rules are reread every session because the failure modes
they prevent recur every session.

### 1. Think Before Coding

State assumptions explicitly before writing any line. When the request
is ambiguous, present the alternative interpretations and ask which
applies. When the request contradicts itself, surface the contradiction
rather than silently picking one side. When you are confused, stop and
ask — confusion is signal, not friction.

Anti-patterns this rule prevents:

- Diving into implementation without restating what was actually requested.
- Picking one reading of an ambiguous instruction silently and shipping it.
- Treating two contradictory requirements as if both can be satisfied without comment.
- Treating "I'll figure it out as I go" as a substitute for understanding the goal.
- Generating code first and asking clarifying questions only after a failure.

### 2. Simplicity First

Write the smallest thing that satisfies the request. No features
beyond what was asked. No abstractions for code with one caller. No
flexibility for callers that do not exist. No error handling for
scenarios that cannot occur given the code's invariants. The
senior-engineer test: would a senior engineer reviewing this say it is
overcomplicated for what was asked?

Anti-patterns this rule prevents:

- Adding a helper function "in case we need to call this from elsewhere later."
- Introducing a configuration option for behavior that has one consumer.
- Wrapping internal calls in try/catch when no internal caller throws.
- Designing for a hypothetical second consumer that does not exist.
- Replacing three similar lines with a parameterised abstraction.
- Shipping a "framework" when a function would do.

### 3. Surgical Changes

Touch only what you must to satisfy the task. Adjacent code is out of
scope. Match the existing style of the file you are editing rather than
the style you would have chosen. Clean up only the orphans your own
change created. If you notice an unrelated improvement, leave it as a
follow-up note, not a diff.

Anti-patterns this rule prevents:

- Reformatting untouched lines to "fix style" while editing nearby.
- Refactoring a function that the task did not name.
- Renaming a variable across the file because the new name is "better."
- Deleting code you decided is unused without verifying it has no callers.
- Pulling adjacent code into the diff because "while I'm here."
- Bundling a cleanup pass into a feature commit.

### 4. Goal-Driven Execution

Every task is a goal, not a list of imperative steps. Restate the goal
in a form that is verifiable from on-disk artifacts before writing any
code. For bug fixes: write the failing test that reproduces the bug
first, then make it pass. For performance work: capture the measurement
first, then change the code, then capture it again. For behavioral
changes: define the assertion the diff must satisfy before the diff
exists. "Done" is "the goal is verifiably satisfied," not "the code now
exists."

Anti-patterns this rule prevents:

- "Fix the bug" without a failing test that reproduces it.
- "Improve performance" without a measurement before and a measurement after.
- "Make it work" without a definition of "work" the diff can be checked against.
- Marking a task complete on the basis of "the code now exists" rather than "the goal is satisfied."
- Writing implementation before there is anything that can fail to confirm the goal is met.

These four rules apply to every code-touching turn. They do not
replace the commitment ritual, the rationalisation table, the red
flags, or the evidence rules — they sit alongside them as the
session-level discipline the model brings to every diff.

## What this product is

A multi-project pipeline dashboard: a static SPA on Cloudflare Pages plus one
local daemon that reads each registered project's files and git history. No
project data leaves the machine.

**Product behaviour is specified in `openspec/specs/`, not here.** Twelve
capabilities; read the one you are touching before you touch it:

| Capability | Covers |
|---|---|
| [`filesystem-access-policy`](openspec/specs/filesystem-access-policy/spec.md) | Read-only on project filesystems, path allow-list, file modes. **The security spine — read this one first.** |
| [`daemon-runtime`](openspec/specs/daemon-runtime/spec.md) | Daemon lifecycle, bind modes, health, caching, service install, CLI |
| [`auth-and-pairing`](openspec/specs/auth-and-pairing/spec.md) | Bearer token, rotation, CORS lock, pairing flow |
| [`project-registry`](openspec/specs/project-registry/spec.md) | Registry shape, CRUD, reachability, path drift |
| [`project-dashboard`](openspec/specs/project-dashboard/spec.md) | Home cards and the single-project three-column view |
| [`skills-and-linting`](openspec/specs/skills-and-linting/spec.md) | Skill inventory, AgentLinter, cross-repo drift |
| [`fleet-coverage`](openspec/specs/fleet-coverage/spec.md) | Coverage matrix, freshness states, history and trends |
| [`fleet-conformance`](openspec/specs/fleet-conformance/spec.md) | Conformance scoring, tiers, trend chart, path-drift panel |
| [`code-intelligence`](openspec/specs/code-intelligence/spec.md) | Understand Anything analysis status, commands, and knowledge-graph viewer (GitNexus removed from the dashboard) |
| [`optional-integrations`](openspec/specs/optional-integrations/spec.md) | Sentry / Linear / Infisical, and the works-without-them contract |
| [`help-docs`](openspec/specs/help-docs/spec.md) | The in-product `/help` documentation system |
| [`design-system`](openspec/specs/design-system/spec.md) | Tokens, enforced contrast floors, shared primitives, shell IA |

Project-wide context and the hard constraints also live in
[`openspec/config.yaml`](openspec/config.yaml) under `context:`.

**When a spec disagrees with intuition, the spec wins. When the spec is silent,
open a change (`/opsx:propose`) rather than guessing.** If a proposed change
would violate a constraint in `filesystem-access-policy`, stop and surface the
conflict — do not quietly relax it.

### Historical and reference material

- `docs/spec/dashboard-prompt.md` — the original binding hand-off spec. Still the
  best statement of *why* the product is shaped this way; superseded as a
  statement of *current* behaviour by `openspec/specs/`.
- `docs/legacy-planning/` — the complete GSD-era phase history, read-only. Go
  here to find out how something came to be, not what it does now.
- `openspec/changes/archive/` — those same phases as archived OpenSpec changes.
- `openspec/CAPABILITY-MAP.md` — how 21 phases were merged into 12 capabilities,
  and the open questions recorded during that migration.

## Workflow (project-specific additions)

The global `~/.claude/CLAUDE.md` mandates the AgenticApps workflow. The full
lifecycle, hooks, rituals, and red-flag tables are in
[`docs/WORKFLOW.md`](docs/WORKFLOW.md). On top of that, for this repo:

- **Planning is a spec change.** Work starts with `/opsx:propose`, not with an
  edit. The §18 change-gate blocks code edits while a change is open until
  `openspec validate --all` is green and `REVIEWS.md` carries ≥2 other-vendor
  reviewers. That is the gate working, not a bug.
- Workflow commitment ritual is mandatory at the start of any implementing session.
- TDD applies to every panel, every daemon route, and the bootstrap config
  (CI workflow, pnpm config) — not just feature code.
- Two-stage review (gstack `/review` + `superpowers:requesting-code-review`)
  before merging. Stages do not collapse.
- **Every frontend-touching change runs the `impeccable:critique` skill** against
  affected routes at 1440×900 and commits the resulting artifact: composite +
  per-heuristic scores, findings, persona red flags. Composite floor **≥ 80**
  (ratified 2026-06-08), with a structural-debt waiver clause for a route
  structurally below floor. This is a *process* gate, which is why it lives here
  and not in a spec; the product outcomes it protects are in `design-system`.
- Optional integrations are **explicitly held** unless the corresponding upstream
  tooling is set up. Don't preemptively wire them in.
- Run `pnpm lint` before shipping — CI enforces it and the phase gate does not.

## Common commands

Workspace-wide (run from repo root):

- `pnpm -r typecheck` — type-check every package.
- `pnpm -r build` — build every package via tsup/Vite/tsc as appropriate.
- `pnpm lint` — eslint. **CI enforces this and it blocks merge; run it before shipping.**

Prefer the per-package test commands below over `pnpm -r test` — the recursive
run is flaky in this workspace.

Per-package (preferred when iterating):

- `pnpm --filter @agenticapps/dashboard-agent test` — agent vitest run.
- `pnpm --filter @agenticapps/dashboard-spa dev` — Vite dev server on `localhost:5174`.
- `pnpm --filter @agenticapps/dashboard-shared test` — shared schema tests.

Daemon CLI (after `pnpm --filter @agenticapps/dashboard-agent build`):

- `agentic-dashboard start` — launch the daemon. Flags: `--bind <127.0.0.1|tailscale|0.0.0.0>`, `--port`, `--no-enforce-cidr`.
- `agentic-dashboard stop` — graceful shutdown via `/api/admin/shutdown`.
- `agentic-dashboard status [--json]` — daemon health + registry count.
- `agentic-dashboard register <path>` (or `--auto <parentDir>`) — add project to registry.
- `agentic-dashboard unregister <idOrPath>` — remove from registry.
- `agentic-dashboard list [--json]` — list registered projects with reachability/phase/lastCommit.
- `agentic-dashboard rename <id> <newName>` / `agentic-dashboard tag <id> <tags...>`.
- `agentic-dashboard rotate-token` — issue a new bearer token (D-13/D-14/D-15).
- `agentic-dashboard pair` — print a fresh pair URL for this device.

## Workflow

This project uses the AgenticApps OpenSpec + Superpowers workflow (v3.0.0).
Full lifecycle, hooks, rituals, and red-flag tables: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).
Vendored — re-sync via `/update-agenticapps-workflow`.
