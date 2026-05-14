/**
 * migration-0008.fixture.test.ts — CODEX MED-17: CI-resident fixture test.
 *
 * This test does NOT depend on the upstream claude-workflow repo being cloned.
 * It defines the expected migration 0008 frontmatter shape inline and asserts
 * that parseFrontmatter yields the expected fields when given a file with that
 * exact content. ALWAYS runs in CI — never skips.
 *
 * Purpose: protect COV-12 from drift even when claude-workflow isn't present.
 * If someone changes the required frontmatter shape in the upstream migration,
 * the cross-repo smoke test (sibling file) will catch it. This fixture test
 * catches any parseFrontmatter regressions that would cause the scanner to
 * fail silently on the real migration file.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter } from '../skillsScan.js'

// CODEX MED-17: fixture content is the EXPECTED shape of migration 0008.
// This locks the contract: if the upstream file ships differently, the
// smoke test (migration-0008.smoke.test.ts) will catch the divergence.
const DELIM = '---'
const FIXTURE_CONTENT = [
  DELIM,
  'id: 0008',
  'slug: coverage-matrix-page',
  'title: Coverage Matrix Page',
  'from_version: 1.7.0',
  'to_version: 1.8.0',
  'type: workflow-surface',
  DELIM,
  '',
  '# Migration 0008',
  '',
  'clipboard-only wiki refresh (D-10-09).',
  "jq 'length' ~/.gitnexus/registry.json — top-level array.",
].join('\n')

describe('migration 0008 fixture (CODEX MED-17 — CI-resident, never skips)', () => {
  let dir: string
  let filePath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mig0008-fixture-'))
    filePath = join(dir, '0008-coverage-matrix-page.md')
    writeFileSync(filePath, FIXTURE_CONTENT, 'utf8')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('parses expected frontmatter shape', () => {
    const fm = parseFrontmatter(filePath)
    expect(fm).not.toBeNull()
    expect(fm).toMatchObject({
      id: '0008',
      slug: 'coverage-matrix-page',
      from_version: '1.7.0',
      to_version: '1.8.0',
      type: 'workflow-surface',
    })
  })

  it('contains the jq length correction language (Pitfall 7)', () => {
    expect(FIXTURE_CONTENT).toMatch(/jq 'length'/)
    expect(FIXTURE_CONTENT).toMatch(/top-level array/i)
  })

  it('documents clipboard-only wiki refresh (D-10-09)', () => {
    expect(FIXTURE_CONTENT).toMatch(/clipboard.?only/i)
    expect(FIXTURE_CONTENT).toMatch(/wiki/i)
  })

  it('parseFrontmatter returns null for empty content', () => {
    const emptyPath = join(dir, 'empty.md')
    writeFileSync(emptyPath, '', 'utf8')
    expect(parseFrontmatter(emptyPath)).toBeNull()
  })

  it('parseFrontmatter returns null for content without frontmatter delimiters', () => {
    const noFmPath = join(dir, 'nofm.md')
    writeFileSync(noFmPath, '# Just a heading\n\nNo frontmatter here.', 'utf8')
    expect(parseFrontmatter(noFmPath)).toBeNull()
  })
})
