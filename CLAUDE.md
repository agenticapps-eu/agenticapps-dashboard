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

## Repository state

**Phases 0 and 1 shipped.** Phase 0 stood up the pnpm workspace, the Cloudflare Pages preview deploy, and the `@agenticapps/dashboard-agent` placeholder package. Phase 1 landed the local daemon (Hono on `127.0.0.1:5193`), the registry (`~/.agenticapps/dashboard/registry.json`), bearer-token auth, the CLI surface, and the `/api/projects/{id}/read` allow-list. **Phase 2 (SPA shell + pair flow) is the next work.**

Authoritative inputs:

- `docs/spec/dashboard-prompt.md` — **the spec that drives all phases. Read it before doing anything substantive.**
- `.planning/phases/01-daemon-registry-pairing/` — Phase 1 plan, decisions (D-01..D-23), threat model, verification, human-UAT.
- `.claude/skills/agenticapps-workflow/` — the workflow skill (Superpowers + GSD + gstack contract).

When the spec disagrees with intuition, the spec wins. When the spec is silent, surface the question via `/gsd-discuss-phase` rather than guessing.

## Architecture (target — most does not exist yet)

Three-package pnpm workspace, two deployment targets, one local daemon:

- `packages/shared/` — Zod schemas + TS types. **Single source of truth** for all daemon ↔ SPA wire shapes. Both ends validate against the same schema; mismatch surfaces as "schema drift" in the SPA.
- `packages/spa/` — Vite + React 18 + TS + Tailwind + TanStack Query. Static SPA deployed to Cloudflare Pages at `dashboard.agenticapps.eu`. **Holds no user data**; only renders what the local daemon serves.
- `packages/agent/` — Node 20+ + Hono + TS. Local daemon at `127.0.0.1:5193`, single binary `agentic-dashboard`. Reads `.planning/`, `.claude/`, and `git log` per registered project; reads `~/.claude/skills/` globally.

Runtime topology: SPA in browser → bearer-token HTTP → local daemon → filesystem reads. The SPA can also point at a Tailscale hostname for remote-device access. **No cloud-side data storage.**

## Hard architectural constraints

These are non-negotiable and must survive every refactor. Source: spec §"Constraints I want preserved" and §"Anti-features".

- **Read-only on project filesystems.** No daemon route writes to a registered project's files. Sole exception: `POST /api/projects/{id}/open` spawns `$EDITOR` (user-driven, per click).
- **Path allow-list per project.** `/api/projects/{id}/read` only resolves under `<root>/.planning` or `<root>/.claude`. Reject `..`, absolute paths, or realpaths outside the allow-list.
- **Daemon writes confined to `~/.agenticapps/dashboard/`.** Registry, auth, env files are mode `0600`; daemon refuses to start if permissions are looser.
- **No native dependencies in `packages/agent/`.** Keeps `npx @agenticapps/dashboard-agent` portable. No `keytar`, no FFI. A `0600` file in `$HOME` is the auth-token store.
- **Bearer-token auth on every route.** CORS locked to `https://dashboard.agenticapps.eu` (prod) and `http://localhost:5174` (dev).
- **Optional integrations stay optional.** Sentry, Linear, Infisical panels show "configure to enable" empty states when env vars are unset. The dashboard must function fully without any of them — Phases 0–6 ship with zero third-party service dependencies.
- **No Cloudflare Workers / Pages Functions in v1.** SPA is pure static.
- **Every frontend-touching phase commits an `<N>-IMPECCABLE.md` artifact.** Generated by running the `impeccable:critique` skill against affected routes at 1440×900; records composite + per-heuristic scores + findings + persona red flags. Composite floor ≥ 80 (D-10.5-03.calibration-2, ratified 2026-06-08; per-phase structural-debt waiver clause in VERIFICATION.md for a route structurally below floor). Phase 6's CI gate retired (D-10.5-01); skill-driven phase artifact is the gate (D-10.5-02). See `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md`.

If a proposed change violates any of the above, stop and surface the conflict — don't quietly relax the constraint.

## Workflow (project-specific additions)

The global `~/.claude/CLAUDE.md` already mandates the AgenticApps workflow (Superpowers + GSD + gstack with enforced hooks). On top of that, for this repo:

- Every phase follows GSD: `/gsd-discuss-phase N` → `/gsd-plan-phase N` → `/gsd-execute-phase N` → verify. Do not skip discuss/plan even for "obvious" bootstrap work — the spec lists Phase 0 questions to surface.
- Workflow commitment ritual is mandatory at the start of any implementing session.
- TDD applies to every panel, every daemon route, and the bootstrap config (CI workflow, pnpm config) — not just feature code.
- Two-stage review (gstack `/review` + `superpowers:requesting-code-review`) before merging any phase. Stages do not collapse.
- Phases 7+ (Sentry / Linear / Infisical integrations) are **explicitly held** until the corresponding upstream tooling is set up. Don't preemptively wire them in.

## Phase order (from the spec)

`Phase 0` repo bootstrap & Cloudflare Pages skeleton → `Phase 1` daemon + registry + pairing → `Phase 2` SPA shell + pair flow → `Phase 3` multi-project home → `Phase 4` single-project Discipline + Phase columns → `Phase 5` Skills + Health column (incl. AgentLinter) → `Phase 6` polish, `install-launchd`, impeccable critique gate, CF Access. Phases 0–6 ship a complete dashboard. Phase 7+ are additive.

## Common commands

Workspace-wide (run from repo root):

- `pnpm -r typecheck` — type-check every package.
- `pnpm -r test` — run vitest in every package (160+ tests as of Phase 1 close).
- `pnpm -r build` — build every package via tsup/Vite/tsc as appropriate.

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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **agenticapps-dashboard** (6712 symbols, 7864 relationships, 59 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/agenticapps-dashboard/context` | Codebase overview, check index freshness |
| `gitnexus://repo/agenticapps-dashboard/clusters` | All functional areas |
| `gitnexus://repo/agenticapps-dashboard/processes` | All execution flows |
| `gitnexus://repo/agenticapps-dashboard/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->


## Workflow

This project uses the AgenticApps Superpowers + GSD + gstack workflow.
Full hooks, rituals, and red-flag tables: [`.claude/claude-md/workflow.md`](.claude/claude-md/workflow.md).
Vendored — re-sync via `/update-agenticapps-workflow`.
