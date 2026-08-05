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

  it('tolerates and discards an old daemon gitnexus extension', () => {
    const valid = {
      ok: true,
      version: '1.0.0',
      daemonVersion: '1.0.0',
      registryCount: 3,
      paired: true,
      gitnexus: { installed: true, canScan: true },
    }
    const parsed = HealthResponseSchema.parse(valid)
    expect(parsed).not.toHaveProperty('gitnexus')
  })

  // The `understand` block's own four tests went with the block in
  // `retire-v1-surfaces`. What replaces them is the same shape as the gitnexus
  // case above: a daemon predating the cutover still sends it, and a v2 client
  // must tolerate that payload and drop the field rather than reject the
  // response outright.
  it('tolerates and discards an old daemon understand extension', () => {
    const valid = {
      ok: true,
      version: '1.0.0',
      daemonVersion: '1.0.0',
      registryCount: 3,
      paired: true,
      understand: {
        viewerInstalled: true,
        viewerVersion: '2.7.6',
        pluginVersion: '2.7.6',
        updateAvailable: false,
      },
    }
    const parsed = HealthResponseSchema.parse(valid)
    expect(parsed).not.toHaveProperty('understand')
  })
})
