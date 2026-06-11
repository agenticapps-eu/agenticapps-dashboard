import { describe, it, expect } from 'vitest'
import {
  LinearIssueSchema,
  LinearIssuesResponseSchema,
} from './linear.js'

const baseIssue = {
  identifier: 'ACME-123',
  title: 'Fix auth redirect loop',
  url: 'https://linear.app/acme/issue/ACME-123',
  stateName: 'In Progress',
  stateType: 'started' as const,
  assigneeName: 'Alice',
}

describe('LinearIssueSchema', () => {
  it('parses a fully populated issue', () => {
    const result = LinearIssueSchema.parse(baseIssue)
    expect(result.identifier).toBe('ACME-123')
    expect(result.title).toBe('Fix auth redirect loop')
    expect(result.url).toBe('https://linear.app/acme/issue/ACME-123')
    expect(result.stateName).toBe('In Progress')
    expect(result.stateType).toBe('started')
    expect(result.assigneeName).toBe('Alice')
  })

  it('parses with assigneeName=null (unassigned)', () => {
    const result = LinearIssueSchema.parse({ ...baseIssue, assigneeName: null })
    expect(result.assigneeName).toBeNull()
  })

  it('parses all stateType values', () => {
    const types = ['started', 'completed', 'cancelled', 'backlog', 'unstarted'] as const
    for (const stateType of types) {
      const result = LinearIssueSchema.parse({ ...baseIssue, stateType })
      expect(result.stateType).toBe(stateType)
    }
  })

  it('rejects an unknown stateType', () => {
    expect(() =>
      LinearIssueSchema.parse({ ...baseIssue, stateType: 'archived' })
    ).toThrow()
  })

  it('rejects a non-URL url field', () => {
    expect(() =>
      LinearIssueSchema.parse({ ...baseIssue, url: 'not-a-url' })
    ).toThrow()
  })
})

describe('LinearIssuesResponseSchema', () => {
  it('parses a minimal response with empty issues array', () => {
    const result = LinearIssuesResponseSchema.parse({ issues: [] })
    expect(result.issues).toEqual([])
  })

  it('parses a response with up to 3 issues', () => {
    const issues = Array.from({ length: 3 }, (_, i) => ({
      ...baseIssue,
      identifier: `ACME-${i + 1}`,
    }))
    const result = LinearIssuesResponseSchema.parse({ issues })
    expect(result.issues).toHaveLength(3)
  })

  it('rejects an issues array longer than 3 (D-08-07 cap)', () => {
    const issues = Array.from({ length: 4 }, (_, i) => ({
      ...baseIssue,
      identifier: `ACME-${i + 1}`,
    }))
    expect(() => LinearIssuesResponseSchema.parse({ issues })).toThrow()
  })

  it('parses with top-level stale metadata (whole-panel outage)', () => {
    const result = LinearIssuesResponseSchema.parse({
      issues: [],
      stale: true,
      staleFrom: '2026-06-11T09:00:00Z',
      staleReason: 'unreachable',
    })
    expect(result.stale).toBe(true)
    expect(result.staleFrom).toBe('2026-06-11T09:00:00Z')
    expect(result.staleReason).toBe('unreachable')
  })

  it('defaults stale to false when not provided', () => {
    const result = LinearIssuesResponseSchema.parse({ issues: [] })
    expect(result.stale).toBe(false)
  })

  it('parses staleReason=rate-limited', () => {
    const result = LinearIssuesResponseSchema.parse({
      issues: [],
      stale: true,
      staleReason: 'rate-limited',
    })
    expect(result.staleReason).toBe('rate-limited')
  })

  it('rejects an unknown staleReason', () => {
    expect(() =>
      LinearIssuesResponseSchema.parse({
        issues: [],
        stale: true,
        staleReason: 'timeout',
      })
    ).toThrow()
  })
})
