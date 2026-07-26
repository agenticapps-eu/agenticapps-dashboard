# Phase 5: Skills + Health Panels -

**Archived from GSD phase `05-skills-health-panels`. Completed 2026-05-08.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/05-skills-health-panels/` — that tree, not this file, is the authoritative record.

## Why

Closing the single-project view by adding the right column (Skills + Health) AND closing the Phase 4 G1 deferral by shipping the meta-observer transcript persister that fills `.planning/skill-observations/`. Phase 5 owns producer + consumer of the discipline data path, so the dashboard ships with populated CommitmentBlock + HookFirings panels for the first time.

In scope (REQUIREMENTS Phase 5):

- **HEALTH-01 InstalledSkills** — global `~/.claude/skills/*/SKILL.md` + project `<root>/.claude/skills/*/SKILL.md`, frontmatter only.
- **HEALTH-02 SkillHealth** — `npx agentlinter scan` results with score + Position Risk warnings, cached 1h or until SKILL.md mtime change.
- **HEALTH-03 ObservabilityHealth** — Spotlight / Sentry SDK / sentry-cli detection via grep on `package.json` + CI files, multi-signal.
- **HEALTH-04 SecretsHealth** — `.infisical.json` file presence + JSON-validity check (informational only; no Infisical API calls).
- **HEALTH-05 IntegrationsHealth** — Sentry / Linear / Infisical three-state (`configured` / `present-but-not-configured` / `not-detected`) with inline one-paragraph guides.
- **Layout transition** — `<SingleProjectView />` grid widens from 2-col (`1fr 1.5fr`) to 3-col (`1fr 1.5fr 1fr`) via single CSS-rule change staged by Phase 4 D-4-09. Right column = third `<section>` with the five panels.
- **Transcript persister (G1 unblocker)** — new `packages/me

## Capabilities affected

- `openspec/specs/skills-and-linting/spec.md`
- `openspec/specs/optional-integrations/spec.md`

## What shipped

**05-01**

### Wave-0 Probes (Task 0)

Both fixtures captured and committed before any implementation:

**Transcript shape probe (`sample-transcript.jsonl`):**
- Real shape from session `fa0fd1c5-b13e-452a-954a-ef1beb6edac2`
- Top-level keys: `type`, `parentUuid`, `isSidechain`, `uuid`, `timestamp`, `userType`, `entrypoint`, `cwd`, `sessionId`, `version`, `gitBranch`
- Markdown body at: `message.content[].text` (for `content[i].type === 'text'`)
- Tool use: `message.content[].type === 'tool_use'`, `name`, `input` fields
- Non-message types: `attachment`, `system`, `file-history-snapshot`, `last-prompt`

**05-02**

### Task 1: skillsScan.ts (TDD — 17 tests)

`packages/agent/src/lib/skillsScan.ts` exports:
- `parseFrontmatter(skillMdPath)` — null-safe YAML frontmatter reader with `description: |` literal block support, dirname-based name fallback, passthrough for unknown fields.
- `readGlobalSkills(root)` — reads `<root>/*/SKILL.md` or `<root>/*/skill/SKILL.md` (dual-layout probe), alphabetical sort, realpath symlink-escape defence.
- `readLocalSkills(projectRoot)` — reads `<projectRoot>/.claude/skills/`, same logic.

**Dual-layout probe** mirrors `phaseDetail.ts:129-137` exactly: canonical (`<dir>/SKILL.

**05-03**

### Task 1: `resolveAllowedNamed` + `computeIntegrationState` (TDD — 12 tests)

**`packages/agent/src/lib/paths.ts` extension (appended, existing code untouched):**

`resolveAllowedNamed(candidatePath, { roots[], allowedNames? | extension? })`:
- Realpaths the candidate; throws `PathViolation` if not accessible
- Realpaths each root; throws if realpath escapes all roots
- With `allowedNames`: rejects if `basename(real)` not in the list
- With `extension`: rejects if `basename(real)` doesn't end with it
- Both provided simultaneously → throws `PathViolation` (mutually exclusive)
- `ALLOWED_SUBD

**05-04**

### Task 1: 3 New Query Hooks (TDD — 13 new tests, 31 total in file)

Three hooks appended to `packages/spa/src/lib/projectQueries.ts` (existing 5 hooks unchanged):

| Hook | Query Key | staleTime | refetchInterval | Notes |
|------|-----------|-----------|-----------------|-------|
| `useGlobalSkills()` | `['skills', 'global']` | 60s | 60s | Singleton — no projectId (D-5-12) |
| `useLocalSkills(id)` | `['skills', 'local', id]` | 60s | 60s | Per-project; id in key (T-05-04) |
| `useAgentLinter(id)` | `['agentlinter', id]` | 1h | none | Manual retry only (D-5-14/D-5-15) |

Cross-project cache i

**05-05**

### Task 1: 3 New Query Hooks (TDD — 9 new tests, 40 total in file)

Three hooks appended to `packages/spa/src/lib/projectQueries.ts` (existing 8 hooks unchanged):

| Hook | Query Key | staleTime | refetchInterval | Notes |
|------|-----------|-----------|-----------------|-------|
| `useObservability(id)` | `['observability', id]` | 5s | 5s | Per-project; id in key (T-05-05) |
| `useSecrets(id)` | `['secrets', id]` | 5s | 5s | Per-project; id in key (T-05-05) |
| `useIntegrations(id)` | `['integrations', id]` | 5s | 5s | Per-project; id in key (T-05-05) |

All 3 follow the POLL_MS constant (5

**05-06**

**Task 1 — 3-col layout (D-5-01 staged transition complete)**
- `SingleProjectView.tsx` widened from `grid-cols-[1fr_1.5fr]` → `grid-cols-[1fr_1.5fr_1fr]`.
- Added `<section data-testid="health-column" aria-label="Health">` mounting all 5 Phase 5 panels.
- Phase 4 D-4-09 staged transition note in file header marked complete.

**Task 2 — meta-observer e2e script**
- `packages/meta-observer/test/end-to-end.mjs` — scripted SessionEnd round-trip.
- Spawns `hooks/session-end.mjs` with a synthetic SessionEnd payload, asserts the producer writes `.md` + `.jsonl` to `<root>/.planning/skill-observation

## Gates recorded

- verification — `05-VERIFICATION.md`
- code review — `05-REVIEW.md`
- human UAT — `05-HUMAN-UAT.md`
- validation — `05-VALIDATION.md`
