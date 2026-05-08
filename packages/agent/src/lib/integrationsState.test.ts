import { describe, it, expect } from 'vitest'

import { computeIntegrationState } from './integrationsState.js'

describe('computeIntegrationState', () => {
  it('returns configured when envVarPresent=true signalDetected=true', () => {
    expect(computeIntegrationState({ envVarPresent: true, signalDetected: true })).toBe('configured')
  })

  it('returns configured when envVarPresent=true signalDetected=false (env var trumps signal)', () => {
    expect(computeIntegrationState({ envVarPresent: true, signalDetected: false })).toBe('configured')
  })

  it('returns present-but-not-configured when envVarPresent=false signalDetected=true', () => {
    expect(computeIntegrationState({ envVarPresent: false, signalDetected: true })).toBe(
      'present-but-not-configured',
    )
  })

  it('returns not-detected when envVarPresent=false signalDetected=false', () => {
    expect(computeIntegrationState({ envVarPresent: false, signalDetected: false })).toBe(
      'not-detected',
    )
  })
})
