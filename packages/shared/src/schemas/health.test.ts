import { describe, it, expect } from 'vitest'

import { HealthResponseSchema } from '../index.js'

describe('HealthResponseSchema', () => {
  it('accepts a valid health response', () => {
    const valid = { ok: true, version: '0.0.1-alpha.3' }
    expect(() => HealthResponseSchema.parse(valid)).not.toThrow()
  })

  it('rejects missing ok field', () => {
    expect(() => HealthResponseSchema.parse({ version: '0.0.1' })).toThrow()
  })

  it('accepts optional message', () => {
    const valid = { ok: true, version: '1.0.0', message: 'hi' }
    const parsed = HealthResponseSchema.parse(valid)
    expect(parsed.message).toBe('hi')
  })

  it('accepts new optional fields (daemonVersion, registryCount, paired)', () => {
    const v = { ok: true, version: '1.0.0', daemonVersion: '0.1.0', registryCount: 3, paired: true }
    const parsed = HealthResponseSchema.parse(v)
    expect(parsed.daemonVersion).toBe('0.1.0')
    expect(parsed.registryCount).toBe(3)
    expect(parsed.paired).toBe(true)
  })

  it('still accepts old shape (only ok + version)', () => {
    expect(() => HealthResponseSchema.parse({ ok: true, version: '0.0.1' })).not.toThrow()
  })

  // Phase 13 D-13-11b: gitnexus composite field
  it('parses a response WITH gitnexus field (installed + canScan)', () => {
    const valid = {
      ok: true,
      version: '1.0.0',
      daemonVersion: '1.0.0',
      registryCount: 3,
      paired: true,
      gitnexus: { installed: true, canScan: true },
    }
    const parsed = HealthResponseSchema.parse(valid)
    expect(parsed.gitnexus).toEqual({ installed: true, canScan: true })
  })

  it('parses gitnexus with canScan=false (tailscale bind mode)', () => {
    const valid = {
      ok: true,
      version: '1.0.0',
      daemonVersion: '1.0.0',
      registryCount: 0,
      paired: false,
      gitnexus: { installed: true, canScan: false },
    }
    const parsed = HealthResponseSchema.parse(valid)
    expect(parsed.gitnexus).toEqual({ installed: true, canScan: false })
  })

  it('rejects gitnexus with unknown extra fields (inner .strict() enforcement)', () => {
    const invalid = {
      ok: true,
      version: '1.0.0',
      gitnexus: { installed: true, canScan: false, extra: 'should-fail' },
    }
    expect(() => HealthResponseSchema.parse(invalid)).toThrow()
  })

  // Phase 14 D-14-02: understand block on HealthResponseSchema
  it('(understand-1) back-compat: payload WITHOUT understand field parses (pre-Phase-14 daemon)', () => {
    const prePhase14 = { ok: true, version: '1.0.0' }
    expect(() => HealthResponseSchema.parse(prePhase14)).not.toThrow()
  })

  it('(understand-2) payload with full understand block parses', () => {
    const valid = {
      ok: true,
      version: '1.0.0',
      understand: {
        viewerInstalled: true,
        viewerVersion: '2.7.6',
        pluginVersion: '2.7.6',
        updateAvailable: false,
      },
    }
    const parsed = HealthResponseSchema.parse(valid)
    expect(parsed.understand).toEqual({
      viewerInstalled: true,
      viewerVersion: '2.7.6',
      pluginVersion: '2.7.6',
      updateAvailable: false,
    })
  })

  it('(understand-3) nullable viewerVersion and pluginVersion parse (viewer not installed / plugin cache absent)', () => {
    const valid = {
      ok: true,
      version: '1.0.0',
      understand: {
        viewerInstalled: false,
        viewerVersion: null,
        pluginVersion: null,
        updateAvailable: false,
      },
    }
    expect(() => HealthResponseSchema.parse(valid)).not.toThrow()
    const parsed = HealthResponseSchema.parse(valid)
    expect(parsed.understand?.viewerVersion).toBeNull()
    expect(parsed.understand?.pluginVersion).toBeNull()
  })

  it('(understand-4) unknown key inside understand FAILS parse (.strict() — token deliberately excluded)', () => {
    const invalid = {
      ok: true,
      version: '1.0.0',
      // viewerToken is deliberately excluded from /health (per D-14-02 and plan objective)
      understand: {
        viewerInstalled: true,
        viewerVersion: '2.7.6',
        pluginVersion: '2.7.6',
        updateAvailable: false,
        viewerToken: 'x',
      },
    }
    expect(() => HealthResponseSchema.parse(invalid)).toThrow()
  })
})
