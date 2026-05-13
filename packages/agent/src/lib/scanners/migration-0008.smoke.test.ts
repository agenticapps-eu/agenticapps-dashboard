/**
 * migration-0008.smoke.test.ts — Cross-repo smoke test for migration 0008.
 *
 * CODEX MED-17: When the upstream claude-workflow repo is NOT present at the
 * expected path, this test emits a console.warn (NOT a silent skip) so the CI
 * gap is visible. The fixture test (sibling file) still protects the contract.
 *
 * When upstream IS present, asserts:
 *   - File exists at canonical path
 *   - Frontmatter contains id=0008, slug, from_version, to_version=1.8.0
 *   - Migration documents the jq registry.json correction (top-level array)
 *   - Migration documents the clipboard-only wiki refresh stance (D-10-09)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter } from '../skillsScan.js'

const MIGRATION_PATH = join(
  homedir(),
  'Sourcecode',
  'agenticapps',
  'claude-workflow',
  'migrations',
  '0008-coverage-matrix-page.md',
)

const HAS_UPSTREAM = existsSync(MIGRATION_PATH)

if (!HAS_UPSTREAM) {
  // CODEX MED-17: emit a visible warn instead of silently skipping.
  // The fixture test (migration-0008.fixture.test.ts) still protects the contract.
  console.warn(
    '[migration-0008.smoke] WARN: upstream claude-workflow not present at ' +
      MIGRATION_PATH +
      '. Cross-repo smoke skipped; fixture test (migration-0008.fixture.test.ts) still runs.',
  )
}

describe('migration 0008 smoke (cross-repo; warns when upstream missing)', () => {
  it.skipIf(!HAS_UPSTREAM)('migration 0008 file exists at canonical path', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
  })

  it.skipIf(!HAS_UPSTREAM)('frontmatter has required id, slug, from_version, to_version', () => {
    const fm = parseFrontmatter(MIGRATION_PATH)
    expect(fm).not.toBeNull()
    expect(fm).toMatchObject({
      id: '0008',
      slug: 'coverage-matrix-page',
      from_version: '1.7.0',
      to_version: '1.8.0',
    })
  })

  it.skipIf(!HAS_UPSTREAM)('to_version is 1.8.0 (COV-12 version contract)', () => {
    const fm = parseFrontmatter(MIGRATION_PATH)
    expect((fm as Record<string, unknown>)?.to_version).toBe('1.8.0')
  })

  it.skipIf(!HAS_UPSTREAM)('documents jq registry.json correction (Pitfall 7)', () => {
    const content = readFileSync(MIGRATION_PATH, 'utf8')
    // Must document the corrected 'jq length' form (top-level array)
    expect(content).toMatch(/jq 'length'/)
    // Must reference the top-level array note (the correction, not the bug)
    expect(content).toMatch(/top-level array/i)
  })

  it.skipIf(!HAS_UPSTREAM)('documents clipboard-only wiki refresh stance (D-10-09)', () => {
    const content = readFileSync(MIGRATION_PATH, 'utf8')
    expect(content).toMatch(/clipboard.?only/i)
    expect(content).toMatch(/wiki/i)
  })
})
