/**
 * gitnexusScan.test.ts — RED test scaffold for Phase 13 shared Zod schemas.
 *
 * Wave 0 Plan 13-00 Task 2: these tests drive creation of gitnexusScan.ts.
 * All assertions here will fail until gitnexusScan.ts is created (GREEN step).
 *
 * Covers:
 *   (a) GitnexusScanRequestSchema — repo scope + regex guard + strict
 *   (b) GitnexusScanRequestSchema — family scope + enum guard + strict
 *   (c) GitnexusScanErrorCodeSchema — enum accept + reject
 *   (d) GitnexusScanProgressSchema — repo-kind running job accept
 *   (e) GitnexusScanProgressSchema — family-kind running job accept
 *   (f) GitnexusScanProgressSchema — reject mixed kind fields
 *   (g) GitnexusScanResponseSchema — ok:true + ok:false shapes
 */

import { describe, it, expect } from 'vitest'

import {
  GitnexusScanRequestSchema,
  GitnexusScanResponseSchema,
  GitnexusScanProgressSchema,
  GitnexusScanErrorCodeSchema,
} from './gitnexusScan.js'

describe('GitnexusScanRequestSchema', () => {
  describe('repo scope', () => {
    it('accepts valid repo scope with slug/slug target', () => {
      expect(() =>
        GitnexusScanRequestSchema.parse({ scope: 'repo', target: 'agenticapps/dashboard' })
      ).not.toThrow()
      expect(GitnexusScanRequestSchema.parse({ scope: 'repo', target: 'agenticapps/dashboard' })).toEqual({
        scope: 'repo',
        target: 'agenticapps/dashboard',
      })
    })

    it('rejects path-traversal in target (regex guard)', () => {
      expect(() =>
        GitnexusScanRequestSchema.parse({ scope: 'repo', target: '../../etc/passwd' })
      ).toThrow()
    })

    it('rejects repo scope with extra keys (.strict())', () => {
      expect(() =>
        GitnexusScanRequestSchema.parse({ scope: 'repo', target: 'agenticapps/foo', extra: 1 })
      ).toThrow()
    })
  })

  describe('family scope', () => {
    it('accepts valid family scope with agenticapps', () => {
      expect(() =>
        GitnexusScanRequestSchema.parse({ scope: 'family', target: 'agenticapps' })
      ).not.toThrow()
    })

    it('accepts valid family scope with factiv', () => {
      expect(() =>
        GitnexusScanRequestSchema.parse({ scope: 'family', target: 'factiv' })
      ).not.toThrow()
    })

    it('accepts valid family scope with neuroflash', () => {
      expect(() =>
        GitnexusScanRequestSchema.parse({ scope: 'family', target: 'neuroflash' })
      ).not.toThrow()
    })

    it("rejects family target 'other' (not in enum)", () => {
      expect(() =>
        GitnexusScanRequestSchema.parse({ scope: 'family', target: 'other' })
      ).toThrow()
    })

    it('rejects family scope with extra keys (.strict())', () => {
      expect(() =>
        GitnexusScanRequestSchema.parse({ scope: 'family', target: 'agenticapps', extra: true })
      ).toThrow()
    })
  })
})

describe('GitnexusScanErrorCodeSchema', () => {
  it("accepts 'BIND_REFUSED'", () => {
    expect(GitnexusScanErrorCodeSchema.parse('BIND_REFUSED')).toBe('BIND_REFUSED')
  })

  it("accepts 'BINARY_NOT_FOUND'", () => {
    expect(GitnexusScanErrorCodeSchema.parse('BINARY_NOT_FOUND')).toBe('BINARY_NOT_FOUND')
  })

  it("accepts 'SCAN_IN_FLIGHT'", () => {
    expect(GitnexusScanErrorCodeSchema.parse('SCAN_IN_FLIGHT')).toBe('SCAN_IN_FLIGHT')
  })

  it("accepts 'SCAN_NOT_FOUND'", () => {
    expect(GitnexusScanErrorCodeSchema.parse('SCAN_NOT_FOUND')).toBe('SCAN_NOT_FOUND')
  })

  it("rejects unknown code 'UNKNOWN'", () => {
    expect(() => GitnexusScanErrorCodeSchema.parse('UNKNOWN')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => GitnexusScanErrorCodeSchema.parse('')).toThrow()
  })
})

describe('GitnexusScanResponseSchema', () => {
  it('accepts ok:true with scanId UUID', () => {
    const payload = { ok: true, scanId: 'c4a7f3b0-1234-4abc-8def-000000000001' }
    expect(() => GitnexusScanResponseSchema.parse(payload)).not.toThrow()
  })

  it('accepts ok:false with error code + requestId', () => {
    const payload = { ok: false, error: 'BIND_REFUSED', requestId: 'req-abc-123' }
    expect(() => GitnexusScanResponseSchema.parse(payload)).not.toThrow()
  })

  it('rejects ok:true without scanId', () => {
    expect(() => GitnexusScanResponseSchema.parse({ ok: true })).toThrow()
  })

  it('rejects ok:false with invalid error code', () => {
    expect(() =>
      GitnexusScanResponseSchema.parse({ ok: false, error: 'INVALID_CODE', requestId: 'r1' })
    ).toThrow()
  })
})

describe('GitnexusScanProgressSchema', () => {
  it('accepts repo-kind running job', () => {
    const payload = {
      ok: true,
      job: {
        kind: 'repo',
        scanId: 'c4a7f3b0-1234-4abc-8def-000000000002',
        repoId: 'agenticapps/dashboard',
        state: 'running',
        startedAt: new Date().toISOString(),
      },
    }
    expect(() => GitnexusScanProgressSchema.parse(payload)).not.toThrow()
  })

  it('accepts family-kind running job', () => {
    const payload = {
      ok: true,
      job: {
        kind: 'family',
        scanId: 'c4a7f3b0-1234-4abc-8def-000000000003',
        familyId: 'agenticapps',
        state: 'running',
        startedAt: new Date().toISOString(),
        total: 5,
        completed: 2,
        failed: 0,
        currentRepoId: 'agenticapps/dashboard',
        currentScanId: 'c4a7f3b0-1234-4abc-8def-000000000004',
        perRepoResults: [],
      },
    }
    expect(() => GitnexusScanProgressSchema.parse(payload)).not.toThrow()
  })

  it('rejects repo-kind job with family fields mixed in', () => {
    const payload = {
      ok: true,
      job: {
        kind: 'repo',
        scanId: 'c4a7f3b0-1234-4abc-8def-000000000005',
        repoId: 'agenticapps/dashboard',
        state: 'running',
        startedAt: new Date().toISOString(),
        // family-only fields — .strict() should reject
        total: 5,
        completed: 2,
        failed: 0,
      },
    }
    expect(() => GitnexusScanProgressSchema.parse(payload)).toThrow()
  })

  it('accepts ok:false progress response with error code', () => {
    const payload = {
      ok: false,
      error: 'SCAN_NOT_FOUND',
      requestId: 'req-xyz-789',
    }
    expect(() => GitnexusScanProgressSchema.parse(payload)).not.toThrow()
  })

  it('accepts repo-kind done job with completedAt', () => {
    const now = new Date().toISOString()
    const payload = {
      ok: true,
      job: {
        kind: 'repo',
        scanId: 'c4a7f3b0-1234-4abc-8def-000000000006',
        repoId: 'factiv/cparx',
        state: 'done',
        startedAt: now,
        completedAt: now,
      },
    }
    expect(() => GitnexusScanProgressSchema.parse(payload)).not.toThrow()
  })

  it('accepts repo-kind error job with error object', () => {
    const now = new Date().toISOString()
    const payload = {
      ok: true,
      job: {
        kind: 'repo',
        scanId: 'c4a7f3b0-1234-4abc-8def-000000000007',
        repoId: 'neuroflash/backend',
        state: 'error',
        startedAt: now,
        completedAt: now,
        error: { code: 'SCAN_FAILED', message: 'gitnexus exited with code 1' },
      },
    }
    expect(() => GitnexusScanProgressSchema.parse(payload)).not.toThrow()
  })
})

// ── Codex CRITICAL #1 hardening (D-13-EXT-11) ────────────────────────────────
//
// The original regex /^[a-z0-9\-]+\/[a-z0-9\-_.]+$/ accepted 'agenticapps/..'
// because the repo character class includes '.', so '..' is two valid chars.
// Codex review of PR #52 surfaced this as CRITICAL #1. D-13-EXT-11 records
// the two-layer fix: tighter regex (leading [a-z0-9] required) + .refine()
// rejecting '.'/'..'/embedded-'..'.
describe('GitnexusScanRequestSchema repo target — D-13-EXT-11 path-traversal hardening', () => {
  it('rejects target ending in .. (Codex CRITICAL #1)', () => {
    const r = GitnexusScanRequestSchema.safeParse({ scope: 'repo', target: 'agenticapps/..' })
    expect(r.success).toBe(false)
  })

  it('rejects target ending in . (parent self-reference)', () => {
    const r = GitnexusScanRequestSchema.safeParse({ scope: 'repo', target: 'agenticapps/.' })
    expect(r.success).toBe(false)
  })

  it('rejects target with .. nested in segment', () => {
    const r = GitnexusScanRequestSchema.safeParse({ scope: 'repo', target: 'agenticapps/foo..bar' })
    expect(r.success).toBe(false)
  })

  it('rejects target whose repo segment starts with a dot', () => {
    const r = GitnexusScanRequestSchema.safeParse({ scope: 'repo', target: 'agenticapps/.hidden' })
    expect(r.success).toBe(false)
  })

  it('rejects target whose repo segment starts with a hyphen', () => {
    const r = GitnexusScanRequestSchema.safeParse({ scope: 'repo', target: 'agenticapps/-leading-hyphen' })
    expect(r.success).toBe(false)
  })

  it('rejects target whose repo segment starts with an underscore', () => {
    const r = GitnexusScanRequestSchema.safeParse({ scope: 'repo', target: 'agenticapps/_underscore' })
    expect(r.success).toBe(false)
  })

  it('still accepts known-good repo names from the wild', () => {
    for (const target of [
      'factiv/cparx',
      'agenticapps/agenticapps-dashboard',
      'neuroflash/q-and-a',
      'agenticapps/claude-workflow',
      'agenticapps/pi-agentic-apps-workflow',
      'agenticapps/codex-workflow',
      'agenticapps/dotclaude',
      'agenticapps/open-design',
      'agenticapps/agentlinter',
    ]) {
      const r = GitnexusScanRequestSchema.safeParse({ scope: 'repo', target })
      expect(r.success, `should accept ${target}`).toBe(true)
    }
  })
})
