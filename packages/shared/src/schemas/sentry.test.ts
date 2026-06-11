import { describe, it, expect } from 'vitest'
import {
  SentryIssueSchema,
  SentryRecentResponseSchema,
} from './sentry.js'

const baseIssue = {
  id: 'abc123',
  title: 'TypeError: cannot read property',
  level: 'error' as const,
  count: '1423',
  lastSeen: '2026-06-11T10:00:00Z',
  permalink: 'https://sentry.io/organizations/acme/issues/abc123/',
  shortId: 'PROJ-123',
}

describe('SentryIssueSchema', () => {
  it('parses an issue with count as a string ("1423")', () => {
    const result = SentryIssueSchema.parse({ ...baseIssue, count: '1423' })
    expect(result.count).toBe('1423')
  })

  it('parses an issue with count as a number (1423) and coerces to string', () => {
    const result = SentryIssueSchema.parse({ ...baseIssue, count: 1423 })
    expect(result.count).toBe('1423')
  })

  it('parses all level values (fatal, error, warning, info, debug)', () => {
    const levels = ['fatal', 'error', 'warning', 'info', 'debug'] as const
    for (const level of levels) {
      const result = SentryIssueSchema.parse({ ...baseIssue, level })
      expect(result.level).toBe(level)
    }
  })

  it('rejects an unknown level', () => {
    expect(() => SentryIssueSchema.parse({ ...baseIssue, level: 'critical' })).toThrow()
  })

  it('rejects a non-URL permalink', () => {
    expect(() => SentryIssueSchema.parse({ ...baseIssue, permalink: 'not-a-url' })).toThrow()
  })

  // CR-01: javascript:/data: scheme rejection
  it('CR-01: rejects a javascript: permalink (XSS vector)', () => {
    expect(() =>
      SentryIssueSchema.parse({ ...baseIssue, permalink: 'javascript:alert(1)' })
    ).toThrow()
  })

  it('CR-01: rejects a data: permalink (XSS vector)', () => {
    expect(() =>
      SentryIssueSchema.parse({ ...baseIssue, permalink: 'data:text/html,<script>alert(1)</script>' })
    ).toThrow()
  })

  it('CR-01: accepts https: permalink', () => {
    const result = SentryIssueSchema.parse({
      ...baseIssue,
      permalink: 'https://sentry.io/organizations/acme/issues/999/',
    })
    expect(result.permalink).toContain('https://')
  })
})

describe('SentryRecentResponseSchema', () => {
  it('parses a minimal response with empty issues array', () => {
    const result = SentryRecentResponseSchema.parse({ issues: [] })
    expect(result.issues).toEqual([])
    expect(result.stale).toBe(false)
  })

  it('parses a response with up to 5 issues', () => {
    const issues = Array.from({ length: 5 }, (_, i) => ({
      ...baseIssue,
      id: `issue-${i}`,
    }))
    const result = SentryRecentResponseSchema.parse({ issues })
    expect(result.issues).toHaveLength(5)
  })

  it('rejects an issues array longer than 5', () => {
    const issues = Array.from({ length: 6 }, (_, i) => ({
      ...baseIssue,
      id: `issue-${i}`,
    }))
    expect(() => SentryRecentResponseSchema.parse({ issues })).toThrow()
  })

  it('parses with stale=true, staleFrom ISO, and staleReason=unreachable', () => {
    const result = SentryRecentResponseSchema.parse({
      issues: [],
      stale: true,
      staleFrom: '2026-06-11T09:00:00Z',
      staleReason: 'unreachable',
    })
    expect(result.stale).toBe(true)
    expect(result.staleFrom).toBe('2026-06-11T09:00:00Z')
    expect(result.staleReason).toBe('unreachable')
  })

  it('parses with staleReason=unauthorized', () => {
    const result = SentryRecentResponseSchema.parse({
      issues: [],
      stale: true,
      staleReason: 'unauthorized',
    })
    expect(result.staleReason).toBe('unauthorized')
  })

  it('parses with staleReason=rate-limited', () => {
    const result = SentryRecentResponseSchema.parse({
      issues: [],
      stale: true,
      staleReason: 'rate-limited',
    })
    expect(result.staleReason).toBe('rate-limited')
  })

  it('rejects an unknown staleReason', () => {
    expect(() =>
      SentryRecentResponseSchema.parse({
        issues: [],
        stale: true,
        staleReason: 'server-error',
      })
    ).toThrow()
  })

  it('defaults stale to false when not provided', () => {
    const result = SentryRecentResponseSchema.parse({ issues: [baseIssue] })
    expect(result.stale).toBe(false)
  })
})
