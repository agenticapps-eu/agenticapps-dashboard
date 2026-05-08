import { describe, it, expect } from 'vitest'

import {
  ObservabilitySignalSchema,
  ObservabilityToolStateSchema,
  ObservabilityResponseSchema,
} from './observability.js'

const allSignals = [
  'sentry-sdk-dep',
  'sentry-cli-script',
  'sentryclirc',
  'sentry-dsn-env',
  'spotlight-dep',
  'spotlight-dir',
  'sentry-cli-binary',
  'sentry-cli-ci',
] as const

describe('ObservabilitySignalSchema', () => {
  for (const signal of allSignals) {
    it(`accepts signal: ${signal}`, () => {
      const input = { signal, evidence: `Found ${signal}` }
      expect(ObservabilitySignalSchema.parse(input)).toEqual(input)
    })
  }

  it('rejects an unknown signal name', () => {
    expect(() =>
      ObservabilitySignalSchema.parse({ signal: 'unknown-signal', evidence: 'test' })
    ).toThrow()
  })

  it('rejects a signal without evidence', () => {
    expect(() => ObservabilitySignalSchema.parse({ signal: 'sentry-sdk-dep' })).toThrow()
  })
})

describe('ObservabilityToolStateSchema', () => {
  it('parses detected: true with signals', () => {
    const input = {
      detected: true,
      signals: [{ signal: 'sentry-sdk-dep' as const, evidence: '@sentry/node in package.json' }],
    }
    expect(ObservabilityToolStateSchema.parse(input)).toEqual(input)
  })

  it('parses detected: false with empty signals', () => {
    const input = { detected: false, signals: [] }
    expect(ObservabilityToolStateSchema.parse(input)).toEqual(input)
  })
})

describe('ObservabilityResponseSchema', () => {
  it('parses a full observability response with all three top-level keys', () => {
    const toolState = { detected: false, signals: [] }
    const input = { sentry: toolState, spotlight: toolState, sentryCli: toolState }
    expect(ObservabilityResponseSchema.parse(input)).toEqual(input)
  })

  it('rejects response missing spotlight', () => {
    const toolState = { detected: false, signals: [] }
    expect(() =>
      ObservabilityResponseSchema.parse({ sentry: toolState, sentryCli: toolState })
    ).toThrow()
  })

  it('rejects response missing sentryCli', () => {
    const toolState = { detected: false, signals: [] }
    expect(() =>
      ObservabilityResponseSchema.parse({ sentry: toolState, spotlight: toolState })
    ).toThrow()
  })

  it('round-trip stability: parse → serialize → re-parse equals input', () => {
    const input = {
      sentry: {
        detected: true,
        signals: [
          { signal: 'sentry-sdk-dep' as const, evidence: '@sentry/node' },
          { signal: 'sentryclirc' as const, evidence: '.sentryclirc file found' },
        ],
      },
      spotlight: { detected: false, signals: [] },
      sentryCli: {
        detected: true,
        signals: [{ signal: 'sentry-cli-ci' as const, evidence: '.github/workflows/ci.yml' }],
      },
    }
    const serialized = JSON.stringify(ObservabilityResponseSchema.parse(input))
    const reparsed = ObservabilityResponseSchema.parse(JSON.parse(serialized))
    expect(reparsed).toEqual(input)
  })
})
