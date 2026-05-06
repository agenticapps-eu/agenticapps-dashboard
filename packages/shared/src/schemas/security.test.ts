import { describe, it, expect } from 'vitest'

import { CsoSummarySchema, DbSentinelSummarySchema, SecurityResponseSchema } from './security.js'

describe('CsoSummarySchema', () => {
  it('parses a valid CSO summary', () => {
    const input = { fileName: '04-SECURITY.md', content: 'audit notes...' }
    expect(CsoSummarySchema.parse(input)).toEqual(input)
  })
})

describe('DbSentinelSummarySchema', () => {
  it('parses a valid DB sentinel summary', () => {
    const input = { fileName: '04-SECURITY.md', content: 'db audit...' }
    expect(DbSentinelSummarySchema.parse(input)).toEqual(input)
  })
})

describe('SecurityResponseSchema', () => {
  it('parses null/null (no audit shape)', () => {
    const input = { cso: null, dbSentinel: null }
    expect(SecurityResponseSchema.parse(input)).toEqual(input)
  })

  it('parses both cso and dbSentinel present', () => {
    const input = {
      cso: { fileName: 'x', content: 'y' },
      dbSentinel: { fileName: 'x', content: 'y' },
    }
    expect(SecurityResponseSchema.parse(input)).toEqual(input)
  })
})
