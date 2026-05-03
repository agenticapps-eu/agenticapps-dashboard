import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock execa BEFORE importing tailscale (vi.mock is hoisted)
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'

import { getTailscaleIP, getTailscaleHostname, TailscaleNotDetectedError } from './tailscale.js'

const mockExeca = execa as unknown as ReturnType<typeof vi.fn>

describe('getTailscaleIP', () => {
  beforeEach(() => mockExeca.mockReset())

  it('returns trimmed IP on success', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '100.64.5.5\n', stderr: '', exitCode: 0 } as unknown as Awaited<ReturnType<typeof execa>>)
    await expect(getTailscaleIP()).resolves.toBe('100.64.5.5')
  })

  it('throws TailscaleNotDetectedError with exact message when binary absent (ENOENT)', async () => {
    const err: NodeJS.ErrnoException = Object.assign(new Error('not found'), { code: 'ENOENT' })
    mockExeca.mockRejectedValueOnce(err)
    try {
      await getTailscaleIP()
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(TailscaleNotDetectedError)
      expect((e as Error).message).toBe(
        'Tailscale not detected. Install from https://tailscale.com or use --bind 127.0.0.1.',
      )
    }
  })

  it('throws TailscaleNotDetectedError on non-zero exit (daemon down)', async () => {
    mockExeca.mockRejectedValueOnce(new Error('exit 1'))
    await expect(getTailscaleIP()).rejects.toBeInstanceOf(TailscaleNotDetectedError)
  })

  it('throws TailscaleNotDetectedError on empty stdout', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '   \n', stderr: '', exitCode: 0 } as unknown as Awaited<ReturnType<typeof execa>>)
    await expect(getTailscaleIP()).rejects.toBeInstanceOf(TailscaleNotDetectedError)
  })
})

describe('getTailscaleHostname', () => {
  beforeEach(() => mockExeca.mockReset())

  it('strips trailing dot from Self.DNSName', async () => {
    const status = { Self: { DNSName: 'devbox.tailfa84dd.ts.net.' } }
    mockExeca.mockResolvedValueOnce({ stdout: JSON.stringify(status), stderr: '', exitCode: 0 } as unknown as Awaited<ReturnType<typeof execa>>)
    await expect(getTailscaleHostname('100.64.5.5')).resolves.toBe('devbox.tailfa84dd.ts.net')
  })

  it('falls back to IP when Self.DNSName is empty', async () => {
    const status = { Self: { DNSName: '' } }
    mockExeca.mockResolvedValueOnce({ stdout: JSON.stringify(status), stderr: '', exitCode: 0 } as unknown as Awaited<ReturnType<typeof execa>>)
    await expect(getTailscaleHostname('100.64.5.5')).resolves.toBe('100.64.5.5')
  })

  it('falls back to IP when Self.DNSName missing', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '{}', stderr: '', exitCode: 0 } as unknown as Awaited<ReturnType<typeof execa>>)
    await expect(getTailscaleHostname('100.64.5.5')).resolves.toBe('100.64.5.5')
  })

  it('falls back to IP when execa rejects', async () => {
    mockExeca.mockRejectedValueOnce(new Error('daemon down'))
    await expect(getTailscaleHostname('100.64.5.5')).resolves.toBe('100.64.5.5')
  })

  it('falls back to IP when JSON parse fails', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: 'not json', stderr: '', exitCode: 0 } as unknown as Awaited<ReturnType<typeof execa>>)
    await expect(getTailscaleHostname('100.64.5.5')).resolves.toBe('100.64.5.5')
  })
})
