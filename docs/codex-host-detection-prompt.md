# Hand-off prompt: add Codex host detection to HostAdapter

Self-contained spec for adding `host: codex` to `agenticapps-dashboard`'s
HostAdapter so the dashboard can list and inspect projects installed
against `codex-workflow` v0.1.0.

The dashboard's HostAdapter currently probes the Claude
(`~/.claude/skills/`) and pi layouts. After this work it probes the
Codex layout too.

---

## Read first

- `agenticapps-dashboard/.planning/REQUIREMENTS.md` and `ROADMAP.md` for
  where HostAdapter lives in the dashboard's existing phase structure
- `~/Sourcecode/codex-workflow/` — the scaffolder that produces the
  on-disk shape this work consumes
- `~/Sourcecode/codex-workflow/docs/decisions/0001-codex-skill-naming.md`
  (the canonical Codex paths for skills + project-side state)
- `~/Sourcecode/codex-workflow/skills/setup-codex-agenticapps-workflow/SKILL.md`
  (the skill that *writes* the project-side state HostAdapter will read)
- `~/Sourcecode/codex-workflow/migrations/0000-baseline.md` (the apply
  steps; useful to confirm exactly which paths exist post-setup)
- `~/Sourcecode/agenticapps-workflow-core/spec/09-conformance.md` —
  the dashboard claims `consumer-only` conformance; this work
  reaffirms that claim by adding a third-host probe

---

## Goal

A project that has been bootstrapped via
`$setup-codex-agenticapps-workflow` lands at this on-disk shape:

| Path | Role | Detection cue |
|---|---|---|
| `<project>/.codex/workflow-version.txt` | Per-project version pin (single line, e.g. `0.1.0`) | **Primary cue.** Existence = "this project uses codex-workflow" |
| `<project>/.codex/workflow-config.md` | Project metadata (name, repo, backend, frontend, db, llm, gate quality bars) | Secondary — read for project-summary fields |
| `<project>/.planning/config.json` | Gate-to-skill bindings (the hook config; same shape as Claude's project-side `.planning/config.json`) | Same shape as Claude — existing parser likely reuses |
| `<project>/AGENTS.md` | Workflow sections marked by `<!-- BEGIN: agentic-apps-workflow sections -->` ... `<!-- END: agentic-apps-workflow sections -->` | Tertiary — equivalent to Claude's CLAUDE.md content marker |
| `${CODEX_HOME:-$HOME/.codex}/skills/agentic-apps-workflow/SKILL.md` | The trigger skill (global, not project-scoped) | Out-of-project signal that codex-workflow is *installed at all* |

After this work, the dashboard:

1. Detects a Codex project by `test -f <project>/.codex/workflow-version.txt`
2. Reads version from that file
3. Reads project metadata from `.codex/workflow-config.md` (parse the
   markdown table or the YAML-ish key/value list)
4. Reads gate bindings from `.planning/config.json` (same parser as Claude)
5. Marks the project as `host: codex` in the dashboard's project listing
6. Existing Claude / pi detection paths are unchanged

---

## Phase plan (sketch — adjust to match the dashboard's existing GSD convention)

### Phase A — Discuss

Run `/gsd-discuss-phase` against this prompt. Open questions to
surface:

1. Where exactly does HostAdapter live in the codebase? (suspected:
   `packages/<host-adapter-package>/src/...` based on the pnpm
   workspace setup)
2. Is there an existing host registry pattern (e.g. plugin-style host
   plugins in `packages/`)? If so, the Codex host should be a new
   plugin rather than a special case in HostAdapter
3. Does the dashboard already parse `.planning/config.json` from
   Claude/pi projects? If yes, reuse the parser for Codex
4. Does the dashboard's UI need a Codex icon / badge? Where do host
   badges live?
5. What test fixture is needed? Recommend creating a temp project,
   running `bash ~/Sourcecode/codex-workflow/install.sh` then
   `$setup-codex-agenticapps-workflow` against the temp project,
   committing the resulting state as a fixture under the
   dashboard's existing fixture tree

### Phase B — Plan

Author `PLAN.md` with:

- Files touched in HostAdapter (or in a new host plugin)
- The detection probe function (returns `{ host: 'codex', version, configPath, agentsPath }` when the cue is present)
- The metadata reader (parses `.codex/workflow-config.md`)
- The reused gate-bindings parser (delegates to existing
  `.planning/config.json` parser)
- The UI badge integration (if applicable)
- Test fixture for an installed Codex project
- Unit tests for: detection cue present/absent, version parse, metadata
  parse, gate parse

### Phase C — Execute

Standard GSD wave execution. The TDD-marked tasks are: detection
function, metadata reader, gate parser delegation. No UI animation /
visual surface required — this is wiring.

### Phase D — Post-phase

Stage 1 + Stage 2 review. The QA gate fires if the dashboard has a
running dev server (likely yes given the package shape suggests a
Next.js or similar app). Browse the dashboard against a fixture
project that's been installed via codex-workflow and confirm the
project shows up with `host: codex`.

### Phase E — Branch close

PR should:

- Reference codex-workflow v0.1.0 (the contract this consumes)
- Close `agenticapps-eu/agenticapps-dashboard` issue #13
- Update the dashboard's host-list documentation (if any) to enumerate
  the three supported hosts: claude, pi, codex
- Update spec/09 conformance citation in the dashboard's own
  instruction file (if it cites a specific spec version, this work
  doesn't change conformance level — `consumer-only` stays)

---

## Hard constraints

- **No host-namespace leakage between Claude / pi / codex.** Each host
  is detected independently. A project is allowed to be installed
  against multiple hosts (rare but valid); the dashboard surfaces all
  detected hosts, not a single one
- **Read-only** of project state. The dashboard never writes into a
  project's `.codex/` or `.planning/`
- **Reuse the `.planning/config.json` parser.** It's the same shape
  across Claude, pi, codex by design — the spec mandates a single
  hook-bindings file shape
- **No fabricated paths.** Every path in this prompt was verified
  during codex-workflow Phase 6 dogfood (see
  `~/Sourcecode/codex-workflow/docs/dogfood-2026-05-10.md`)

---

## Verification (rough)

```bash
# Set up a fixture project
mkdir -p /tmp/dashboard-codex-fixture && cd /tmp/dashboard-codex-fixture
git init -q
bash ~/Sourcecode/codex-workflow/install.sh   # idempotent on existing install
# Walk through $setup-codex-agenticapps-workflow against this dir.
# After it completes, the directory has .codex/workflow-version.txt etc.

# Run the dashboard against this fixture
cd ~/Sourcecode/agenticapps-dashboard
pnpm dev  # or whatever the existing dev command is
# Add /tmp/dashboard-codex-fixture as a project in the dashboard UI.
# Expect: host badge "codex", version "0.1.0".
```

---

## Open questions to surface during discuss

1. Should this work bump the dashboard's `implements_spec` (or its
   equivalent) citation? Probably no — the work is purely
   consumer-side adaptation that doesn't change which spec version
   the dashboard reads
2. Should the dashboard's CLAUDE.md / instruction file gain a
   "supported hosts" section enumerating all three? (low-cost, useful)
3. Is there backward-compat to worry about (e.g. existing dashboard
   users with stored project lists that don't include `host` field)?
   Likely no — the existing schema treats unknown hosts as "unknown",
   and Codex projects newly added would carry `host: codex`

---

## Linked

- codex-workflow v0.1.0 release: https://github.com/agenticapps-eu/codex-workflow/releases/tag/v0.1.0
- Dashboard issue #13: https://github.com/agenticapps-eu/agenticapps-dashboard/issues/13
- Linear initiative "agenticapps-workflow"
- `~/Sourcecode/codex-workflow/docs/dogfood-2026-05-10.md` (full dogfood
  log; the Codex install state is captured there)

---

## Practical: how to run this prompt

```bash
cd ~/Sourcecode/agenticapps-dashboard
claude     # or codex
# Paste this entire file as the first message.
# The trigger skill activates; route through $gsd-discuss-phase.
```

Suggested skill order on the dashboard repo:
`$gsd-discuss-phase` → `$gsd-plan-phase` → `$gsd-execute-phase` →
post-phase pipeline (`codex-spec-review` / `codex-code-review` / `codex-qa`
since dashboard ships UI) → `codex-finishing-branch` opens the PR that
closes issue #13.
