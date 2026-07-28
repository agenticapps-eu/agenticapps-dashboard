/**
 * Tailscale setup diagnostics — RED tests for decide-tailnet-ipv6-policy task 2.
 *
 * `--bind tailscale` fails identically today whether Tailscale is absent
 * altogether or running fine on a node that simply has no CGNAT IPv4 address.
 * Those are different operator problems with different fixes: install/start
 * Tailscale, versus enable IPv4 on a node that is already up. The daemon must
 * tell them apart.
 *
 * This is genuinely new behaviour, which is why it gets a RED/GREEN cycle
 * rather than a characterisation test (design decision 4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock execa BEFORE importing tailscale (vi.mock is hoisted)
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'

import {
  getTailscaleIP,
  TailscaleNotDetectedError,
  TailscaleNoCgnatIPv4Error,
} from './tailscale.js'

const mockExeca = execa as unknown as ReturnType<typeof vi.fn>

type ExecaResult = Awaited<ReturnType<typeof execa>>
const ok = (stdout: string): ExecaResult =>
  ({ stdout, stderr: '', exitCode: 0 }) as unknown as ExecaResult

describe('getTailscaleIP distinguishes the two setup failures', () => {
  beforeEach(() => mockExeca.mockReset())

  it('still returns a CGNAT IPv4 address when one is available', async () => {
    mockExeca.mockResolvedValueOnce(ok('100.64.5.5\n'))
    await expect(getTailscaleIP()).resolves.toBe('100.64.5.5')
  })

  // Unavailable installation — the command could not be run at all.
  it('reports an unavailable installation when the command cannot run', async () => {
    const err: NodeJS.ErrnoException = Object.assign(new Error('not found'), { code: 'ENOENT' })
    mockExeca.mockRejectedValueOnce(err)
    await expect(getTailscaleIP()).rejects.toBeInstanceOf(TailscaleNotDetectedError)
  })

  it('reports an unavailable installation when the daemon is down', async () => {
    mockExeca.mockRejectedValueOnce(new Error('exit 1'))
    await expect(getTailscaleIP()).rejects.toBeInstanceOf(TailscaleNotDetectedError)
  })

  // Running node, no IPv4 — the command ran and answered "nothing".
  it('reports a missing CGNAT IPv4 address when the command succeeds with no output', async () => {
    mockExeca.mockResolvedValueOnce(ok('   \n'))
    await expect(getTailscaleIP()).rejects.toBeInstanceOf(TailscaleNoCgnatIPv4Error)
  })

  it('reports a missing CGNAT IPv4 address when only IPv6 is configured', async () => {
    mockExeca.mockResolvedValueOnce(ok('fd7a:115c:a1e0::1\n'))
    await expect(getTailscaleIP()).rejects.toBeInstanceOf(TailscaleNoCgnatIPv4Error)
  })

  // A non-CGNAT IPv4 from `tailscale ip -4` is anomalous, and binding it would
  // start a daemon whose own boundary refuses every peer — the "starts but
  // serves nobody" outcome the design rejects. Fail before startup instead.
  it('reports a missing CGNAT IPv4 address when the address is outside the range', async () => {
    mockExeca.mockResolvedValueOnce(ok('10.0.0.5\n'))
    await expect(getTailscaleIP()).rejects.toBeInstanceOf(TailscaleNoCgnatIPv4Error)
  })

  it('keeps the two failures as distinct types, not one type with two messages', async () => {
    mockExeca.mockRejectedValueOnce(new Error('exit 1'))
    const absent = await getTailscaleIP().catch((e: unknown) => e)

    mockExeca.mockResolvedValueOnce(ok(''))
    const noIPv4 = await getTailscaleIP().catch((e: unknown) => e)

    expect(absent).toBeInstanceOf(TailscaleNotDetectedError)
    expect(noIPv4).toBeInstanceOf(TailscaleNoCgnatIPv4Error)
    expect(noIPv4).not.toBeInstanceOf(TailscaleNotDetectedError)
    expect((absent as Error).message).not.toBe((noIPv4 as Error).message)
  })

  it('gives each failure its own actionable remediation', async () => {
    const err: NodeJS.ErrnoException = Object.assign(new Error('not found'), { code: 'ENOENT' })
    mockExeca.mockRejectedValueOnce(err)
    const absent = (await getTailscaleIP().catch((e: unknown) => e)) as Error
    // D-17 wording is a spec-fixed string and must not drift.
    expect(absent.message).toBe(
      'Tailscale not detected. Install from https://tailscale.com or use --bind 127.0.0.1.',
    )

    mockExeca.mockResolvedValueOnce(ok(''))
    const noIPv4 = (await getTailscaleIP().catch((e: unknown) => e)) as Error
    // Names the actual problem and the IPv4-only boundary behind it.
    expect(noIPv4.message).toMatch(/IPv4/)
    expect(noIPv4.message).not.toMatch(/not detected/)
  })
})

describe('the CIDR opt-out reaches address validation', () => {
  beforeEach(() => mockExeca.mockReset())

  // Regression. Validating the address against the boundary unconditionally
  // made --bind tailscale --no-enforce-cidr refuse to start on a control
  // server using a custom IPv4 prefix — a setup that worked before, broken by
  // the boundary overruling the operator who had just switched the boundary
  // off. The error did not even mention the flag.
  it('binds a non-CGNAT IPv4 when enforcement is explicitly disabled', async () => {
    mockExeca.mockResolvedValueOnce(ok('10.64.0.5\n'))
    await expect(getTailscaleIP({ requireCgnat: false })).resolves.toBe('10.64.0.5')
  })

  it('still refuses a non-CGNAT IPv4 while enforcement is on', async () => {
    mockExeca.mockResolvedValueOnce(ok('10.64.0.5\n'))
    await expect(getTailscaleIP()).rejects.toBeInstanceOf(TailscaleNoCgnatIPv4Error)
  })

  it('points at the opt-out when the address is merely outside the range', async () => {
    mockExeca.mockResolvedValueOnce(ok('10.64.0.5\n'))
    const err = (await getTailscaleIP().catch((e: unknown) => e)) as Error
    expect(err.message).toContain('--no-enforce-cidr')
    expect(err.message).toContain('100.64.0.0/10')
  })

  // The opt-out cannot conjure an address that is not there, so this still
  // fails, and its message must NOT suggest the flag.
  it('still fails with no IPv4 at all, even under the opt-out', async () => {
    mockExeca.mockResolvedValueOnce(ok('fd7a:115c:a1e0::1\n'))
    const err = (await getTailscaleIP({ requireCgnat: false }).catch((e: unknown) => e)) as Error
    expect(err).toBeInstanceOf(TailscaleNoCgnatIPv4Error)
    expect(err.message).not.toContain('--no-enforce-cidr')
  })
})
