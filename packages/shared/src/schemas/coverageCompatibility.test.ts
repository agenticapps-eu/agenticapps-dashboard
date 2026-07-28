import { describe, expect, it } from 'vitest'
import coverageV1Fixture from '../test-fixtures/coverage-v1.json'
import historyV1Fixture from '../test-fixtures/coverage-history-v1.json'

import { parseCoverageResponse } from './coverage.js'
import { parseCoverageHistoryResponse } from './coverageHistory.js'

const coverageV1 = coverageV1Fixture as Record<string, unknown>
const historyV1 = historyV1Fixture as Record<string, unknown>
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('coverage wire compatibility', () => {
  it('normalises a captured version-1 coverage payload without retired fields', () => {
    const result = parseCoverageResponse(coverageV1)

    expect(result.schemaVersion).toBe(1)
    expect(result.rows[0]).not.toHaveProperty('gitNexus')
    expect(result.rows[0]).not.toHaveProperty('wiki')
    expect(result.rows[0]?.understand?.state).toBe('missing')
  })

  it('maps retained version-1 not-applicable states to missing', () => {
    const payload = clone(coverageV1)
    const firstRow = (payload.rows as Array<Record<string, unknown>>)[0]!
    firstRow.workflowVersion = {
      ...(firstRow.workflowVersion as Record<string, unknown>),
      state: 'not-applicable',
    }

    const result = parseCoverageResponse(payload)

    expect(result.rows[0]?.workflowVersion.state).toBe('missing')
  })

  it('keeps Understand unavailable when an older version-1 daemon omits it', () => {
    const payload = clone(coverageV1)
    delete (payload.rows as Array<Record<string, unknown>>)[0]!.understand

    const result = parseCoverageResponse(payload)

    expect(result.rows[0]?.understand).toBeUndefined()
  })

  it('normalises a captured version-1 history payload to retained cells', () => {
    const result = parseCoverageHistoryResponse(historyV1)

    expect(result.schemaVersion).toBe(1)
    expect(result.cells).toEqual({
      claudeMd: { direction: null, daysSince: null },
      workflowVersion: { direction: 'up', daysSince: 2 },
    })
  })

  it('accepts a strict version-2 coverage payload', () => {
    const payload = clone(coverageV1)
    payload.schemaVersion = 2
    delete payload.gitNexusInstallState
    const firstRow = (payload.rows as Array<Record<string, unknown>>)[0]!
    delete firstRow.gitNexus
    delete firstRow.wiki

    const result = parseCoverageResponse(payload)

    expect(result.schemaVersion).toBe(2)
    expect(result.rows[0]).not.toHaveProperty('gitNexus')
    expect(result.rows[0]).not.toHaveProperty('wiki')
  })

  it('rejects retired cells in a version-2 coverage row', () => {
    const payload = clone(coverageV1)
    payload.schemaVersion = 2
    delete payload.gitNexusInstallState
    const firstRow = (payload.rows as Array<Record<string, unknown>>)[0]!
    delete firstRow.wiki

    expect(() => parseCoverageResponse(payload)).toThrow()
  })

  it('accepts a strict version-2 history payload', () => {
    const payload = clone(historyV1)
    payload.schemaVersion = 2
    const cells = payload.cells as Record<string, unknown>
    delete cells.gitNexus
    delete cells.wiki

    const result = parseCoverageHistoryResponse(payload)

    expect(result.schemaVersion).toBe(2)
    expect(Object.keys(result.cells)).toEqual(['claudeMd', 'workflowVersion'])
  })
})
