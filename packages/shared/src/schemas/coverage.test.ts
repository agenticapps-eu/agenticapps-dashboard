import { describe, expect, it } from 'vitest'

import {
  CoverageBasicColumnSchema,
  CoverageFamilySchema,
  CoverageResponseSchema,
  CoverageRowSchema,
  CoverageStateSchema,
  CoverageWorkflowColumnSchema,
} from './coverage.js'

const validRow = {
  family: 'agenticapps',
  repo: 'dashboard',
  claudeMd: { kind: 'basic', state: 'fresh' },
  workflowVersion: {
    kind: 'workflow',
    state: 'fresh',
    installedVersion: '3.0.0',
    headVersion: '3.0.0',
    detail: 'equal',
  },
  understand: {
    kind: 'basic',
    state: 'fresh',
    viewerToken: 'fixture-viewer-token',
  },
  overrideCount: 0,
  overrides: [],
  inRegistry: true,
}

describe('CoverageStateSchema', () => {
  it.each(['fresh', 'stale', 'missing'])('accepts %s', (state) => {
    expect(CoverageStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects the retired not-applicable state', () => {
    expect(CoverageStateSchema.safeParse('not-applicable').success).toBe(false)
  })
})

describe('coverage column schemas', () => {
  it('accepts current basic and workflow cells', () => {
    expect(
      CoverageBasicColumnSchema.safeParse({ kind: 'basic', state: 'missing' }).success,
    ).toBe(true)
    expect(
      CoverageWorkflowColumnSchema.safeParse(validRow.workflowVersion).success,
    ).toBe(true)
  })

  it('rejects retired scanner metadata on a current basic cell', () => {
    expect(
      CoverageBasicColumnSchema.safeParse({
        kind: 'basic',
        state: 'fresh',
        daysSince: 3,
      }).success,
    ).toBe(false)
  })
})

describe('CoverageRowSchema', () => {
  it('accepts the strict reduced row', () => {
    expect(CoverageRowSchema.safeParse(validRow).success).toBe(true)
  })

  it('requires Understand on version-2 rows', () => {
    const { understand: _understand, ...withoutUnderstand } = validRow
    expect(CoverageRowSchema.safeParse(withoutUnderstand).success).toBe(false)
  })

  it.each(['gitNexus', 'wiki', 'absPath'])('rejects retired/private field %s', (field) => {
    expect(
      CoverageRowSchema.safeParse({ ...validRow, [field]: { kind: 'basic', state: 'fresh' } })
        .success,
    ).toBe(false)
  })
})

describe('CoverageResponseSchema', () => {
  it('accepts strict schema version 2', () => {
    expect(
      CoverageResponseSchema.safeParse({
        schemaVersion: 2,
        generatedAtIso: '2026-07-28T00:00:00Z',
        workflowHeadVersion: '3.0.0',
        rows: [validRow],
      }).success,
    ).toBe(true)
  })

  it('rejects schema version 1 and retired envelope fields', () => {
    expect(
      CoverageResponseSchema.safeParse({
        schemaVersion: 1,
        generatedAtIso: '2026-07-28T00:00:00Z',
        workflowHeadVersion: '3.0.0',
        rows: [],
      }).success,
    ).toBe(false)
    expect(
      CoverageResponseSchema.safeParse({
        schemaVersion: 2,
        generatedAtIso: '2026-07-28T00:00:00Z',
        workflowHeadVersion: '3.0.0',
        gitNexusInstallState: 'installed-with-registry',
        rows: [],
      }).success,
    ).toBe(false)
  })
})

describe('CoverageFamilySchema', () => {
  it.each(['agenticapps', 'factiv', 'neuroflash'])('accepts %s', (family) => {
    expect(CoverageFamilySchema.safeParse(family).success).toBe(true)
  })
})
