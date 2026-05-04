import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pairing } from '@agenticapps/dashboard-shared'

import { getPairing, setPairing, clearPairing } from './pairing.js'

const VALID_PAIRING: Pairing = {
  agentUrl: 'http://localhost:5193',
  token: 'aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344',
  pairedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('lib/pairing — getPairing/setPairing/clearPairing localStorage round-trip', () => {
  it('round-trip: setPairing then getPairing returns the same object', () => {
    setPairing(VALID_PAIRING)
    const result = getPairing()
    expect(result).toEqual(VALID_PAIRING)
  })

  it('missing key returns null', () => {
    expect(getPairing()).toBeNull()
  })

  it('clearPairing removes the key', () => {
    setPairing(VALID_PAIRING)
    clearPairing()
    expect(getPairing()).toBeNull()
  })
})

describe('lib/pairing — corrupt JSON returns null + clears the key', () => {
  it('corrupt JSON in localStorage returns null and clears the key', () => {
    localStorage.setItem('agentic-dashboard:pairing', 'not-json')
    const result = getPairing()
    expect(result).toBeNull()
    expect(localStorage.getItem('agentic-dashboard:pairing')).toBeNull()
  })
})

describe('lib/pairing — schema-failing record returns null + clears the key', () => {
  it('schema-failing record returns null and clears the key and warns once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    localStorage.setItem(
      'agentic-dashboard:pairing',
      JSON.stringify({ agentUrl: 'http://evil.com', token: 'x', pairedAt: 'never' }),
    )
    const result = getPairing()
    expect(result).toBeNull()
    expect(localStorage.getItem('agentic-dashboard:pairing')).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('[pairing] corrupt; clearing')
  })
})

describe('lib/pairing — typeof localStorage === undefined returns null gracefully', () => {
  it('returns null without throwing when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => getPairing()).not.toThrow()
    expect(getPairing()).toBeNull()
  })
})
