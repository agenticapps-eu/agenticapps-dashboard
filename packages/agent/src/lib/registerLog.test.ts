import { describe, it, expect, vi, afterEach } from 'vitest'

import { logBlocked } from './registerLog.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logBlocked', () => {
  it('emits the exact D-15 format to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logBlocked('reason text', '/some/path', 'abc12345', 'req-1')
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0]![0]).toMatch(
      /^\[agent\] BLOCKED register: \/some\/path \(reason text\) tokenHash=abc12345 requestId=req-1$/
    )
  })

  it('escapes newlines in reason to prevent log injection', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logBlocked('reason\nwith newline', '/some/path', 'abc12345', 'req-2')
    const line = spy.mock.calls[0]![0] as string
    expect(line).not.toContain('\n')
    expect(line).toContain('\\n')
  })
})
