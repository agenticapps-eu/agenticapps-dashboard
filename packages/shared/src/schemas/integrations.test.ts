import { describe, it, expect } from 'vitest'

import { IntegrationStateSchema, IntegrationsResponseSchema } from './integrations.js'

describe('IntegrationStateSchema', () => {
  it('accepts configured', () => {
    expect(IntegrationStateSchema.parse('configured')).toBe('configured')
  })

  it('accepts present-but-not-configured', () => {
    expect(IntegrationStateSchema.parse('present-but-not-configured')).toBe('present-but-not-configured')
  })

  it('accepts not-detected', () => {
    expect(IntegrationStateSchema.parse('not-detected')).toBe('not-detected')
  })

  it('rejects enabled (not in the 3-value set)', () => {
    expect(() => IntegrationStateSchema.parse('enabled')).toThrow()
  })

  it('rejects disabled (not in the 3-value set)', () => {
    expect(() => IntegrationStateSchema.parse('disabled')).toThrow()
  })
})

describe('IntegrationsResponseSchema', () => {
  it('parses a response with all three integrations', () => {
    const input = {
      sentry: 'configured' as const,
      linear: 'not-detected' as const,
      infisical: 'present-but-not-configured' as const,
    }
    expect(IntegrationsResponseSchema.parse(input)).toEqual(input)
  })

  it('rejects a response missing sentry', () => {
    expect(() =>
      IntegrationsResponseSchema.parse({
        linear: 'not-detected',
        infisical: 'not-detected',
      })
    ).toThrow()
  })

  it('rejects a response missing linear', () => {
    expect(() =>
      IntegrationsResponseSchema.parse({
        sentry: 'not-detected',
        infisical: 'not-detected',
      })
    ).toThrow()
  })

  it('rejects a response missing infisical', () => {
    expect(() =>
      IntegrationsResponseSchema.parse({
        sentry: 'not-detected',
        linear: 'not-detected',
      })
    ).toThrow()
  })

  it('round-trip stability: parse → serialize → re-parse equals input', () => {
    const input = {
      sentry: 'configured' as const,
      linear: 'not-detected' as const,
      infisical: 'present-but-not-configured' as const,
    }
    const serialized = JSON.stringify(IntegrationsResponseSchema.parse(input))
    const reparsed = IntegrationsResponseSchema.parse(JSON.parse(serialized))
    expect(reparsed).toEqual(input)
  })
})
