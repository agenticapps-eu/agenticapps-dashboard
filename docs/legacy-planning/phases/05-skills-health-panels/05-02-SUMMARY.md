---
phase: 05-skills-health-panels
plan: 02
subsystem: daemon-skills-agentlinter
tags: [daemon, hono, skills, agentlinter, subprocess, cache, tdd, wave-1]
dependency_graph:
  requires:
    - 05-01 (GlobalSkillsResponseSchema, LocalSkillsResponseSchema, AgentLinterResponseSchema)
    - phaseDetail.ts:findSkillPath dual-layout pattern (Phase 4)
    - agentLinterRunner.ts execa (existing agent dep)
  provides:
    - GET /api/skills/global
    - GET /api/projects/:id/skills/local
    - GET /api/projects/:id/agentlinter
    - skillsScan.ts (parseFrontmatter, readGlobalSkills, readLocalSkills)
    - agentLinterRunner.ts (runAgentLinter + privacy invariant --local)
    - agentLinterCache.ts (computeMaxMtime, getAgentLinterCached, setAgentLinterCached)
  affects:
    - plans 04-05 (SPA panels InstalledSkills + SkillHealth call these routes)
    - app.ts (3 new route mounts added)
tech_stack:
  added: []
  patterns:
    - execa argv array form (no shell expansion) for subprocess security
    - realpathSync symlink-escape defence in skill scanner
    - In-memory Map cache with TTL + mtime invalidation
    - outbound() schema parse on every route response (schema drift defense)
    - Dual-layout probe canonical-then-bundle (phaseDetail.ts pattern reused)
key_files:
  created:
    - packages/agent/src/lib/skillsScan.ts
    - packages/agent/src/lib/skillsScan.test.ts
    - packages/agent/src/lib/agentLinterRunner.ts
    - packages/agent/src/lib/agentLinterRunner.test.ts
    - packages/agent/src/lib/agentLinterCache.ts
    - packages/agent/src/lib/agentLinterCache.test.ts
    - packages/agent/src/routes/skills.ts
    - packages/agent/src/routes/agentlinter.ts
    - packages/agent/src/server/__tests__/skills.test.ts
    - packages/agent/src/server/__tests__/agentlinter.test.ts
  modified:
    - packages/agent/src/server/app.ts
decisions:
  - "D-5-12 implemented: singleton /api/skills/global with 60s memo TTL; skillsRoute mounted at /api (not /api/projects)"
  - "Route path correction: agentlinterRoute uses /:id/agentlinter internally (mounted at /api/projects); plan code samples used /projects/:id/agentlinter which doubled the prefix"
  - "description: | literal block parsing: full multi-line read (YAML literal block) rather than truncate-at-first-line; SPA can CSS-clamp to one line per UI-SPEC §Typography"
  - "In-memory cache only (no on-disk persistence): aligns with CONTEXT.md Claude's Discretion default"
  - "bypassCache=1 does NOT call setAgentLinterCached: one-call skip only (D-5-15)"
metrics:
  duration: "~70 minutes"
  completed: "2026-05-07"
  tasks: 3
  files_created: 10
  files_modified: 1
  tests_added: 47
---

# Phase 05 Plan 02: Daemon Skills + AgentLinter Routes Summary

**One-liner:** Daemon-side skills scanner (dual-layout, symlink-safe), AgentLinter subprocess wrapper with `--local` privacy invariant + 5-class outcome, 1h+mtime cache, and 3 Hono routes wired into app.ts.

---

## What Was Built

### Task 1: skillsScan.ts (TDD — 17 tests)

`packages/agent/src/lib/skillsScan.ts` exports:
- `parseFrontmatter(skillMdPath)` — null-safe YAML frontmatter reader with `description: |` literal block support, dirname-based name fallback, passthrough for unknown fields.
- `readGlobalSkills(root)` — reads `<root>/*/SKILL.md` or `<root>/*/skill/SKILL.md` (dual-layout probe), alphabetical sort, realpath symlink-escape defence.
- `readLocalSkills(projectRoot)` — reads `<projectRoot>/.claude/skills/`, same logic.

**Dual-layout probe** mirrors `phaseDetail.ts:129-137` exactly: canonical (`<dir>/SKILL.md`) checked first, then bundle (`<dir>/skill/SKILL.md`).

**Symlink-escape defence** (T-05-02-Symlink-Escape): `realpathSync` on every entry; entry rejected when realpath escapes `realRoot + sep`. Test plants a symlink to `/etc` and asserts it is filtered.

### Task 2: agentLinterRunner.ts + agentLinterCache.ts (TDD — 16 tests)

**agentLinterRunner.ts** (8 tests):

Privacy-invariant argv assertion test (the most critical test in Phase 5):
```typescript
expect(args).toContain('--local')   // T-05-02-AgentLinter-Local
expect(args).toContain('--json')
```

The spawned call is always:
```typescript
execa('npx', ['--yes', 'agentlinter', '--local', '--json', projectRoot], {
  timeout: 30_000,
  reject: false,
  stdio: ['ignore', 'pipe', 'pipe'],
})
```

5-class outcome discrimination: `ok` / `not-installed` / `timeout` / `error` / `unparseable`.

**agentLinterCache.ts** (8 tests):

Cache hit/miss matrix proven by tests:

| Condition | Result |
|-----------|--------|
| Same projectId + same maxMtime + within 1h | HIT |
| Different projectId | MISS |
| Different maxMtime | MISS (mtime invalidation) |
| Same projectId + mtime, but >1h elapsed | MISS (TTL expired) |

`computeMaxMtime(projectRoot, globalRoot?)` walks both project and global SKILL.md roots. `globalRoot` param exposed for testability.

### Task 3: 3 Daemon Routes + app.ts (TDD — 14 tests)

| Route | Mount point in app.ts | File |
|-------|-----------------------|------|
| `GET /api/skills/global` | `app.route('/api', skillsRoute)` | routes/skills.ts |
| `GET /api/projects/:id/skills/local` | `app.route('/api', skillsRoute)` | routes/skills.ts |
| `GET /api/projects/:id/agentlinter` | `app.route('/api/projects', agentlinterRoute)` | routes/agentlinter.ts |

All 3 inherit bearer-auth + CORS from app.ts middleware — zero new auth code.

**bypassCache=1 behaviour** (D-5-15): skips `getAgentLinterCached` AND skips `setAgentLinterCached`. Test A3 verifies via manual cache seed + subsequent cache-miss assertion that bypass truly does not store.

---

## Real-Binary Integration Test

The `AGENTLINTER_REAL` env-gated test in `agentLinterRunner.test.ts` was NOT run during plan execution (guard respected). To run on dev machine:
```bash
AGENTLINTER_REAL=1 pnpm --filter @agenticapps/dashboard-agent test --run src/lib/agentLinterRunner.test.ts
```
Expected: `kind === 'ok'` if agentlinter resolves via `npx --yes`, otherwise `kind === 'not-installed'`.

---

## Security Invariant Verification

**Privacy invariant (T-05-02-AgentLinter-Local):**
```bash
grep -c "'--local'" packages/agent/src/lib/agentLinterRunner.ts
# → 1
grep -c "toContain('--local')" packages/agent/src/lib/agentLinterRunner.test.ts
# → 1
```

**No shell expansion (T-05-02-Subprocess-Inj):**
```bash
grep -c "execa(\`" packages/agent/src/lib/agentLinterRunner.ts
# → 0
```

**No /read allow-list extension (D-5-11 invariant intact):**
```bash
grep ALLOWED_SUBDIRS packages/agent/src/lib/paths.ts
# → still ['.planning', '.claude'] only
```

**No new auth code in routes:**
```bash
grep -c "bearerAuth" packages/agent/src/routes/skills.ts packages/agent/src/routes/agentlinter.ts
# → 0 (auth inherited from app.ts)
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route path prefix doubling**
- Found during: Task 3 (tests failing with 404)
- Issue: Plan's example code showed `agentlinterRoute.get('/projects/:id/agentlinter', ...)` but the route is mounted at `/api/projects` — this doubles the `/projects` prefix to `/api/projects/projects/:id/agentlinter`
- Fix: Changed internal path to `/:id/agentlinter` (matches every other per-project route pattern e.g. `commitment.ts`, `observations.ts`)
- Files modified: `packages/agent/src/routes/agentlinter.ts`

### Minor Adjustments

**2. Registry API: `entry.root` not `entry.path`**
- Plan's example code used `reg.entries[projectId]` and `entry.path` (map-style access)
- Actual registry uses `reg.projects.find((p) => p.id === id)` and `entry.root` (array-style)
- Followed the actual codebase pattern throughout (observations.ts, commitment.ts, etc.)

---

## Known Stubs

None — all 3 lib modules and 3 routes are fully implemented with real logic. No hardcoded empty values flowing to UI rendering.

---

## Threat Flags

None new beyond what the plan's threat model already covers. All T-05-02-* mitigations are implemented and verified via grep + tests.

---

## Self-Check: PASSED
