import { statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { writeServerInfo, readServerInfo, removeServerInfo } from './serverInfo.js'
import { makeTmpHome } from './__fixtures__/tmpHome.js'

describe('serverInfo lib', () => {
  let cleanup: () => void
  let serverFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    serverFile = join(tmp.configDir, 'server.json')
  })

  afterEach(() => cleanup())

  it('writeServerInfo creates server.json with mode 0600', () => {
    writeServerInfo(
      { bindUrl: 'http://127.0.0.1:5193', pid: 1234, startedAt: '2026-05-03T10:00:00.000Z' },
      serverFile,
    )
    expect(existsSync(serverFile)).toBe(true)
    const mode = statSync(serverFile).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it('readServerInfo round-trips through ServerInfoSchema', () => {
    const info = { bindUrl: 'http://127.0.0.1:5193', pid: 1234, startedAt: '2026-05-03T10:00:00.000Z' }
    writeServerInfo(info, serverFile)
    const read = readServerInfo(serverFile)
    expect(read).not.toBeNull()
    expect(read?.bindUrl).toBe(info.bindUrl)
    expect(read?.pid).toBe(info.pid)
    expect(read?.startedAt).toBe(info.startedAt)
  })

  it('removeServerInfo is idempotent', () => {
    writeServerInfo(
      { bindUrl: 'http://127.0.0.1:5193', pid: 1234, startedAt: '2026-05-03T10:00:00.000Z' },
      serverFile,
    )
    removeServerInfo(serverFile)
    expect(existsSync(serverFile)).toBe(false)
    // calling again should not throw
    expect(() => removeServerInfo(serverFile)).not.toThrow()
  })

  it('readServerInfo returns null when file missing', () => {
    const result = readServerInfo(serverFile)
    expect(result).toBeNull()
  })
})
