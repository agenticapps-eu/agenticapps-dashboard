/**
 * coverageColumns.test.ts — Single-source-of-truth contract for COVERAGE_COL_WIDTHS
 * and consumer-grep assertions for CoverageFamilySection + CoverageRow.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { COVERAGE_COL_WIDTHS } from './coverageColumns.js'

const COVERAGE_DIR = resolve(__dirname)

describe('COVERAGE_COL_WIDTHS', () => {
  it('has exactly 6 keys: repo, claudeMd, gitNexus, wiki, workflow, actions', () => {
    const keys = Object.keys(COVERAGE_COL_WIDTHS)
    expect(keys).toHaveLength(6)
    expect(keys).toContain('repo')
    expect(keys).toContain('claudeMd')
    expect(keys).toContain('gitNexus')
    expect(keys).toContain('wiki')
    expect(keys).toContain('workflow')
    expect(keys).toContain('actions')
  })

  it('every value is a string starting with w- (Tailwind width class)', () => {
    for (const [key, value] of Object.entries(COVERAGE_COL_WIDTHS)) {
      expect(typeof value, `COVERAGE_COL_WIDTHS.${key} must be a string`).toBe('string')
      expect(value, `COVERAGE_COL_WIDTHS.${key} must start with w-`).toMatch(/^w-/)
    }
  })

  it('the constants object is frozen (as const — immutable at runtime)', () => {
    expect(Object.isFrozen(COVERAGE_COL_WIDTHS)).toBe(true)
  })

  // Regression lock — these 5 entries are unchanged in Phase 11.2 Plan 03
  it('repo column width is w-72 (288px)', () => {
    expect(COVERAGE_COL_WIDTHS.repo).toBe('w-72')
  })
  it('claudeMd column width is w-32 (128px)', () => {
    expect(COVERAGE_COL_WIDTHS.claudeMd).toBe('w-32')
  })
  it('gitNexus column width is w-36 (144px)', () => {
    expect(COVERAGE_COL_WIDTHS.gitNexus).toBe('w-36')
  })
  it('workflow column width is w-32 (128px)', () => {
    expect(COVERAGE_COL_WIDTHS.workflow).toBe('w-32')
  })
  // Note: actions column is owned by Plan 04 — it stays at 'w-8' (32px) until that plan lands.
  it('actions column width is w-8 (32px) — Plan 04 will widen to w-12', () => {
    expect(COVERAGE_COL_WIDTHS.actions).toBe('w-8')
  })

  // Plan 03 (D-11.2-09): wiki tightening
  it('wiki column width is w-72 (288px) — tightened from w-[22rem] per D-11.2-09', () => {
    expect(COVERAGE_COL_WIDTHS.wiki).toBe('w-72')
  })
})

describe('CoverageFamilySection consumes COVERAGE_COL_WIDTHS', () => {
  it('both CoverageFamilySection.tsx and CoverageRow.tsx import COVERAGE_COL_WIDTHS from coverageColumns, section has <colgroup>, table has table-fixed', () => {
    const sectionSrc = readFileSync(resolve(COVERAGE_DIR, 'CoverageFamilySection.tsx'), 'utf-8')
    const rowSrc = readFileSync(resolve(COVERAGE_DIR, 'CoverageRow.tsx'), 'utf-8')

    // Both files must import COVERAGE_COL_WIDTHS from coverageColumns
    expect(sectionSrc).toMatch(/import.*COVERAGE_COL_WIDTHS.*from.*coverageColumns/)
    expect(rowSrc).toMatch(/import.*COVERAGE_COL_WIDTHS.*from.*coverageColumns/)

    // CoverageFamilySection must contain exactly one <colgroup>
    const colgroupMatches = sectionSrc.match(/<colgroup>/g)
    expect(colgroupMatches, 'CoverageFamilySection.tsx must contain exactly one <colgroup>').toHaveLength(1)

    // CoverageFamilySection must contain table-fixed
    expect(sectionSrc).toContain('table-fixed')
  })
})
