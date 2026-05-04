import { describe, it, expect } from 'vitest'

import { AgentUrlSchema, PairingSchema } from './pairing.js'

const VALID_TOKEN = 'aaaaaaaa-bbbbbbbb-cccccccc-dddddddd-eeeeeeee-ffffffff-00000000-11111111'
const VALID_PAIRED_AT = '2026-05-03T10:00:00.000Z'

describe('AgentUrlSchema — accepted hosts', () => {
  it('accepts http://localhost', () => {
    expect(AgentUrlSchema.safeParse('http://localhost').success).toBe(true)
  })
  it('accepts http://localhost:5193', () => {
    expect(AgentUrlSchema.safeParse('http://localhost:5193').success).toBe(true)
  })
  it('accepts http://127.0.0.1', () => {
    expect(AgentUrlSchema.safeParse('http://127.0.0.1').success).toBe(true)
  })
  it('accepts http://127.0.0.1:5193', () => {
    expect(AgentUrlSchema.safeParse('http://127.0.0.1:5193').success).toBe(true)
  })
  it('accepts Tailscale MagicDNS hostname http', () => {
    expect(AgentUrlSchema.safeParse('http://devbox.tail-abc123.ts.net').success).toBe(true)
  })
  it('accepts Tailscale MagicDNS hostname https with port', () => {
    expect(AgentUrlSchema.safeParse('https://devbox.tail-abc123.ts.net:8443').success).toBe(true)
  })
  it('accepts Tailscale org hostname https', () => {
    expect(AgentUrlSchema.safeParse('https://acme-org.tail-x9z.ts.net').success).toBe(true)
  })
})

describe('AgentUrlSchema — rejected hosts', () => {
  it('rejects LAN IP (non-loopback)', () => {
    expect(AgentUrlSchema.safeParse('http://192.168.1.1').success).toBe(false)
  })
  it('rejects public domain', () => {
    expect(AgentUrlSchema.safeParse('http://evil.com').success).toBe(false)
  })
  it('rejects ts.net lookalike domains', () => {
    expect(AgentUrlSchema.safeParse('http://ts.net.attacker.com').success).toBe(false)
    expect(AgentUrlSchema.safeParse('http://acme.ts.net.attacker.com').success).toBe(false)
  })
  it('rejects non-127.0.0.1 loopback variant', () => {
    expect(AgentUrlSchema.safeParse('http://127.0.0.2').success).toBe(false)
  })
  it('rejects ftp scheme', () => {
    expect(AgentUrlSchema.safeParse('ftp://localhost').success).toBe(false)
  })
  it('rejects lookalike with .ts.net mid-string', () => {
    expect(AgentUrlSchema.safeParse('https://example.com.ts.net.attacker.com').success).toBe(false)
  })
})

describe('PairingSchema — valid input', () => {
  it('accepts a fully valid pairing record', () => {
    const valid = {
      agentUrl: 'http://127.0.0.1:5193',
      token: VALID_TOKEN,
      pairedAt: VALID_PAIRED_AT,
    }
    expect(() => PairingSchema.parse(valid)).not.toThrow()
    expect(PairingSchema.safeParse(valid).success).toBe(true)
  })
  it('both parse() and safeParse() succeed on valid input with correct path', () => {
    const valid = {
      agentUrl: 'http://localhost:5193',
      token: VALID_TOKEN,
      pairedAt: VALID_PAIRED_AT,
    }
    const result = PairingSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agentUrl).toBe('http://localhost:5193')
    }
  })
})

describe('PairingSchema — invalid token', () => {
  it('rejects uppercase hex token', () => {
    const bad = {
      agentUrl: 'http://127.0.0.1:5193',
      token: 'AAAAAAAA-bbbbbbbb-cccccccc-dddddddd-eeeeeeee-ffffffff-00000000-11111111',
      pairedAt: VALID_PAIRED_AT,
    }
    const result = PairingSchema.safeParse(bad)
    expect(result.success).toBe(false)
    if (!result.success) {
      const firstIssue = result.error.issues[0]
      expect(firstIssue?.path).toContain('token')
    }
  })
  it('rejects token with 7 groups instead of 8', () => {
    const bad = {
      agentUrl: 'http://127.0.0.1:5193',
      token: 'aaaaaaaa-bbbbbbbb-cccccccc-dddddddd-eeeeeeee-ffffffff-00000000',
      pairedAt: VALID_PAIRED_AT,
    }
    expect(PairingSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects token missing dashes', () => {
    const bad = {
      agentUrl: 'http://127.0.0.1:5193',
      token: 'aaaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111',
      pairedAt: VALID_PAIRED_AT,
    }
    expect(PairingSchema.safeParse(bad).success).toBe(false)
  })
})

describe('PairingSchema — invalid pairedAt', () => {
  it('rejects date-only string (not ISO datetime)', () => {
    const bad = {
      agentUrl: 'http://127.0.0.1:5193',
      token: VALID_TOKEN,
      pairedAt: '2026-05-03',
    }
    const result = PairingSchema.safeParse(bad)
    expect(result.success).toBe(false)
    if (!result.success) {
      const firstIssue = result.error.issues[0]
      expect(firstIssue?.path).toContain('pairedAt')
    }
  })
  it('rejects Unix timestamp string', () => {
    const bad = {
      agentUrl: 'http://127.0.0.1:5193',
      token: VALID_TOKEN,
      pairedAt: '1714752000',
    }
    expect(PairingSchema.safeParse(bad).success).toBe(false)
  })
})
