/**
 * clipboardCompat.test.ts — Unit tests for writeToClipboard (CODEX LOW-18).
 *
 * Covers:
 * - Modern navigator.clipboard.writeText path (HTTPS / localhost)
 * - Fallback via hidden textarea + document.execCommand('copy')
 * - Always returns Promise<boolean>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeToClipboard } from './clipboardCompat.js'

describe('writeToClipboard', () => {
  let originalClipboard: Clipboard | undefined

  beforeEach(() => {
    originalClipboard = navigator.clipboard
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    })
  })

  it('calls navigator.clipboard.writeText when available and returns true', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    })

    const result = await writeToClipboard('hello')
    expect(mockWriteText).toHaveBeenCalledWith('hello')
    expect(result).toBe(true)
  })

  it('falls back to textarea execCommand when navigator.clipboard is unavailable and returns true on success', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    // jsdom does not implement execCommand; define it so the fallback path works
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    })

    const result = await writeToClipboard('fallback text')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(result).toBe(true)
  })

  it('returns a Promise (callers can await it)', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    })

    const result = writeToClipboard('test')
    expect(result).toBeInstanceOf(Promise)
    await result
  })
})
