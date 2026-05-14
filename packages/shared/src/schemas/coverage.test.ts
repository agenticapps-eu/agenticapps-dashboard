/**
 * Tests for coverage.ts — Zod schemas for /api/coverage response and /api/coverage/refresh.
 *
 * Security contracts encoded per 10-REVIEWS.md:
 * - CODEX HIGH-1: absPath NEVER in public CoverageRowSchema
 * - CODEX HIGH-4: CoverageWorkflowColumnSchema is a discriminated union with 5 sub-states
 * - CODEX HIGH-5: CoverageRefreshActionSchema is ONLY 'gitnexus-analyze'; wiki-compile rejected
 * - AGREED-2: degraded marker on rows + columns for partial-failure isolation
 * - COV-11: 4-state freshness vocabulary: 'fresh' | 'stale' | 'missing' | 'not-applicable'
 */

import { describe, it, expect } from 'vitest'

import {
  CoverageStateSchema,
  CoverageFamilySchema,
  CoverageBasicColumnSchema,
  CoverageWorkflowColumnSchema,
  CoverageColumnStateSchema,
  OverrideEntrySchema,
  CoverageRowSchema,
  CoverageResponseSchema,
  CoverageRefreshActionSchema,
  CoverageRefreshRequestSchema,
  CoverageRefreshResponseSchema,
} from './coverage.js'

describe('CoverageStateSchema', () => {
  it('accepts all 4 enum values', () => {
    expect(() => CoverageStateSchema.parse('fresh')).not.toThrow()
    expect(() => CoverageStateSchema.parse('stale')).not.toThrow()
    expect(() => CoverageStateSchema.parse('missing')).not.toThrow()
    expect(() => CoverageStateSchema.parse('not-applicable')).not.toThrow()
  })

  it('rejects invalid values', () => {
    expect(() => CoverageStateSchema.parse('unknown')).toThrow()
    expect(() => CoverageStateSchema.parse('red')).toThrow()
    expect(() => CoverageStateSchema.parse('ok')).toThrow()
    expect(() => CoverageStateSchema.parse('')).toThrow()
  })
})

describe('CoverageFamilySchema', () => {
  it('accepts the 3 valid family values', () => {
    expect(() => CoverageFamilySchema.parse('agenticapps')).not.toThrow()
    expect(() => CoverageFamilySchema.parse('factiv')).not.toThrow()
    expect(() => CoverageFamilySchema.parse('neuroflash')).not.toThrow()
  })

  it('rejects invalid family values', () => {
    expect(() => CoverageFamilySchema.parse('personal')).toThrow()
    expect(() => CoverageFamilySchema.parse('archive')).toThrow()
    expect(() => CoverageFamilySchema.parse('shared')).toThrow()
    expect(() => CoverageFamilySchema.parse('')).toThrow()
  })
})

describe('CoverageBasicColumnSchema', () => {
  it('accepts minimal shape { kind: basic, state: fresh }', () => {
    expect(() =>
      CoverageBasicColumnSchema.parse({ kind: 'basic', state: 'fresh' })
    ).not.toThrow()
  })

  it('accepts full shape with optional fields', () => {
    expect(() =>
      CoverageBasicColumnSchema.parse({
        kind: 'basic',
        state: 'fresh',
        label: '1.7.0',
        daysSince: 7,
      })
    ).not.toThrow()
  })

  it('accepts degraded marker for partial-failure isolation (AGREED-2)', () => {
    expect(() =>
      CoverageBasicColumnSchema.parse({
        kind: 'basic',
        state: 'missing',
        degraded: true,
        degradedReason: 'EACCES',
      })
    ).not.toThrow()
  })

  it('rejects wrong kind', () => {
    expect(() =>
      CoverageBasicColumnSchema.parse({ kind: 'workflow', state: 'fresh' })
    ).toThrow()
  })
})

describe('CoverageWorkflowColumnSchema (CODEX HIGH-4)', () => {
  it('CASE-1 EQUAL: accepts equal workflow state', () => {
    expect(() =>
      CoverageWorkflowColumnSchema.parse({
        kind: 'workflow',
        state: 'fresh',
        installedVersion: '1.8.0',
        headVersion: '1.8.0',
        detail: 'equal',
      })
    ).not.toThrow()
  })

  it('CASE-2 BEHIND: accepts behind workflow state', () => {
    expect(() =>
      CoverageWorkflowColumnSchema.parse({
        kind: 'workflow',
        state: 'stale',
        installedVersion: '1.7.0',
        headVersion: '1.8.0',
        detail: 'behind',
      })
    ).not.toThrow()
  })

  it('CASE-3 AHEAD: accepts ahead workflow state', () => {
    expect(() =>
      CoverageWorkflowColumnSchema.parse({
        kind: 'workflow',
        state: 'fresh',
        installedVersion: '1.9.0',
        headVersion: '1.8.0',
        detail: 'ahead',
      })
    ).not.toThrow()
  })

  it('CASE-4 VERSION-UNKNOWN: accepts null installedVersion', () => {
    expect(() =>
      CoverageWorkflowColumnSchema.parse({
        kind: 'workflow',
        state: 'stale',
        installedVersion: null,
        headVersion: '1.8.0',
        detail: 'version-unknown',
      })
    ).not.toThrow()
  })

  it('CASE-5 SKILL-MISSING: accepts null installedVersion with skill-missing', () => {
    expect(() =>
      CoverageWorkflowColumnSchema.parse({
        kind: 'workflow',
        state: 'missing',
        installedVersion: null,
        headVersion: '1.8.0',
        detail: 'skill-missing',
      })
    ).not.toThrow()
  })
})

describe('CoverageColumnStateSchema discriminated union', () => {
  it('narrows to basic column', () => {
    const result = CoverageColumnStateSchema.parse({ kind: 'basic', state: 'stale' })
    expect(result.kind).toBe('basic')
  })

  it('narrows to workflow column', () => {
    const result = CoverageColumnStateSchema.parse({
      kind: 'workflow',
      state: 'fresh',
      installedVersion: '1.7.0',
      headVersion: '1.7.0',
      detail: 'equal',
    })
    expect(result.kind).toBe('workflow')
  })
})

describe('OverrideEntrySchema', () => {
  it('accepts valid override entry', () => {
    expect(() =>
      OverrideEntrySchema.parse({
        phaseSlug: '01-foo',
        sinceIso: '2026-05-01T00:00:00Z',
        source: 'git-log',
      })
    ).not.toThrow()
  })

  it('accepts mtime source', () => {
    expect(() =>
      OverrideEntrySchema.parse({
        phaseSlug: '02-bar',
        source: 'mtime',
      })
    ).not.toThrow()
  })
})

describe('CoverageRowSchema', () => {
  const validRow = {
    family: 'agenticapps',
    repo: 'dashboard',
    claudeMd: { kind: 'basic', state: 'fresh' },
    gitNexus: { kind: 'basic', state: 'not-applicable' },
    wiki: { kind: 'basic', state: 'missing' },
    workflowVersion: {
      kind: 'workflow',
      state: 'fresh',
      installedVersion: '1.7.0',
      headVersion: '1.7.0',
      detail: 'equal',
    },
    overrideCount: 0,
    overrides: [],
  }

  it('accepts a valid complete row', () => {
    expect(() => CoverageRowSchema.parse(validRow)).not.toThrow()
  })

  it('accepts row with degraded marker for partial-failure isolation (AGREED-2)', () => {
    expect(() =>
      CoverageRowSchema.parse({
        ...validRow,
        degraded: { reason: 'scanner threw' },
      })
    ).not.toThrow()
  })

  it('CODEX HIGH-1: absPath is NOT in CoverageRowSchema.shape', () => {
    // Guard against future regression — absPath must NEVER appear in the public schema
    const shape = Object.keys(CoverageRowSchema.shape)
    expect(shape).not.toContain('absPath')
  })
})

describe('CoverageResponseSchema', () => {
  it('accepts valid response with empty rows', () => {
    expect(() =>
      CoverageResponseSchema.parse({
        schemaVersion: 1,
        generatedAtIso: '2026-05-13T00:00:00Z',
        gitNexusInstalled: false,
        workflowHeadVersion: null,
        rows: [],
      })
    ).not.toThrow()
  })

  it('rejects schemaVersion !== 1 (literal lock)', () => {
    expect(() =>
      CoverageResponseSchema.parse({
        schemaVersion: 2,
        generatedAtIso: '2026-05-13T00:00:00Z',
        gitNexusInstalled: true,
        workflowHeadVersion: '1.7.0',
        rows: [],
      })
    ).toThrow()
  })
})

describe('CoverageRefreshActionSchema (CODEX HIGH-5)', () => {
  it('accepts gitnexus-analyze', () => {
    expect(() => CoverageRefreshActionSchema.parse('gitnexus-analyze')).not.toThrow()
  })

  it('rejects wiki-compile (D-10-09 — wiki is clipboard-only, never an action)', () => {
    expect(() => CoverageRefreshActionSchema.parse('wiki-compile')).toThrow()
  })

  it('rejects workflow-update (SPA-side clipboard only)', () => {
    expect(() => CoverageRefreshActionSchema.parse('workflow-update')).toThrow()
  })
})

describe('CoverageRefreshRequestSchema (CODEX HIGH-5)', () => {
  it('accepts valid refresh request', () => {
    expect(() =>
      CoverageRefreshRequestSchema.parse({
        family: 'agenticapps',
        repo: 'dashboard',
        action: 'gitnexus-analyze',
      })
    ).not.toThrow()
  })

  it('rejects wiki-compile action (D-10-09)', () => {
    expect(() =>
      CoverageRefreshRequestSchema.parse({
        family: 'agenticapps',
        repo: 'dashboard',
        action: 'wiki-compile',
      })
    ).toThrow()
  })

  it('rejects missing family (required field)', () => {
    expect(() =>
      CoverageRefreshRequestSchema.parse({
        repo: 'dashboard',
        action: 'gitnexus-analyze',
      })
    ).toThrow()
  })
})

describe('CoverageRefreshResponseSchema (CODEX HIGH-5)', () => {
  const validRow = {
    family: 'agenticapps',
    repo: 'dashboard',
    claudeMd: { kind: 'basic', state: 'fresh' },
    gitNexus: { kind: 'basic', state: 'fresh' },
    wiki: { kind: 'basic', state: 'fresh' },
    workflowVersion: {
      kind: 'workflow',
      state: 'fresh',
      installedVersion: '1.7.0',
      headVersion: '1.7.0',
      detail: 'equal',
    },
    overrideCount: 0,
    overrides: [],
  }

  it('accepts ok=true with REQUIRED updatedRow (CODEX HIGH-5)', () => {
    expect(() =>
      CoverageRefreshResponseSchema.parse({
        ok: true,
        kind: 'ok',
        updatedRow: validRow,
      })
    ).not.toThrow()
  })

  it('rejects ok=true with missing updatedRow (updatedRow is REQUIRED on success)', () => {
    const result = CoverageRefreshResponseSchema.safeParse({
      ok: true,
      kind: 'ok',
      // missing updatedRow — CODEX HIGH-5 requires it on ok=true
    })
    expect(result.success).toBe(false)
  })

  it('accepts ok=false with kind=not-installed; updatedRow absent is fine on failure', () => {
    expect(() =>
      CoverageRefreshResponseSchema.parse({
        ok: false,
        kind: 'not-installed',
      })
    ).not.toThrow()
  })

  it('accepts ok=false with kind=error and optional fields', () => {
    expect(() =>
      CoverageRefreshResponseSchema.parse({
        ok: false,
        kind: 'error',
        exitCode: 1,
        stderr: 'gitnexus: command failed',
      })
    ).not.toThrow()
  })
})
