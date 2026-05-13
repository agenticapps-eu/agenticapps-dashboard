/**
 * Test scaffold for workflowVersionScanner.ts — per-repo workflow version detection.
 * Plan 02 implements; Plan 01 provides the it.todo placeholders.
 *
 * CODEX MED-12: directory presence alone is insufficient — SKILL.md frontmatter
 *   `name === 'agentic-apps-workflow'` must be verified before treating the skill as installed.
 * Pitfall 3: version field absent in SKILL.md frontmatter → stale with detail='version-unknown'.
 */

import { describe, it } from 'vitest'

describe('readWorkflowHeadVersion', () => {
  it.todo('picks highest to_version from migrations/*.md files')
  it.todo('returns null when migrations directory is absent')
  it.todo('returns null when no migration file contains a to_version field')
})

describe('scanWorkflowVersionForRepo', () => {
  it.todo('returns detail=equal + state=fresh when installedVersion === headVersion')
  it.todo('returns detail=behind + state=stale when installedVersion < headVersion')
  it.todo('returns detail=ahead + state=fresh when installedVersion > headVersion')
  it.todo("returns detail=skill-missing + state=missing when no SKILL.md found at any CANDIDATE_PATH")
  it.todo(
    'returns detail=version-unknown + state=stale when SKILL.md exists but version field is absent (Pitfall 3)'
  )
  it.todo('probes all 4 CANDIDATE_PATHS for SKILL.md presence (canonical + bundle layouts)')
  it.todo(
    "ENFORCES frontmatter `name === 'agentic-apps-workflow'` identity check (CODEX MED-12): directory presence alone is insufficient — a SKILL.md with wrong name is treated as missing"
  )
  it.todo("returns state=not-applicable when repo doesn't use the agenticapps workflow")
})
