/**
 * cliLockTimeout.test.ts — every CLI mutation command must translate a
 * `registry_lock_timeout` from the registry lib into the helper's exit(1)
 * path instead of leaking the error as an uncaught exception.
 *
 * Lib funcs are mocked to throw the timeout directly; we don't exercise the
 * actual flock mechanic here (that's the registry-mutation-lock test block
 * in registry.test.ts). What we're testing is the CLI wiring: every callsite
 * routes the error through exitOnRegistryLockTimeout.
 *
 * RED first per workflow contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/registry.js', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return {
    ...actual,
    addProject: vi.fn(),
    removeProject: vi.fn(),
    renameProject: vi.fn(),
    setTags: vi.fn(),
  }
})

vi.mock('../lib/auth.js', () => ({
  ensureAuthFile: vi.fn(),
}))

import { addProject, removeProject, renameProject, setTags } from '../lib/registry.js'
import { runRegister, runUnregister } from './register.js'
import { runRename, runTag } from './registryCmd.js'

function mockExitAndStderr() {
  const exitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit(${code ?? 0})`)
    })
  const stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation(() => true)
  return { exitSpy, stderrSpy }
}

function lockTimeoutError(): Error {
  return new Error('registry_lock_timeout: /tmp/agentic/registry.json.lock')
}

describe('CLI commands surface registry_lock_timeout as exit(1) instead of crashing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runRegister(<path>) exits(1) on registry_lock_timeout', async () => {
    const { exitSpy } = mockExitAndStderr()
    vi.mocked(addProject).mockRejectedValue(lockTimeoutError())
    await expect(runRegister('/some/path', {})).rejects.toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('runUnregister(<id>) exits(1) on registry_lock_timeout', async () => {
    const { exitSpy } = mockExitAndStderr()
    vi.mocked(removeProject).mockRejectedValue(lockTimeoutError())
    await expect(runUnregister('some-id')).rejects.toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('runRename(<id>, <name>) exits(1) on registry_lock_timeout', async () => {
    const { exitSpy } = mockExitAndStderr()
    vi.mocked(renameProject).mockRejectedValue(lockTimeoutError())
    await expect(runRename('some-id', 'new-name')).rejects.toThrow(
      'process.exit(1)',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('runTag(<id>, [tags]) exits(1) on registry_lock_timeout', async () => {
    const { exitSpy } = mockExitAndStderr()
    vi.mocked(setTags).mockRejectedValue(lockTimeoutError())
    await expect(runTag('some-id', ['t1', 't2'])).rejects.toThrow(
      'process.exit(1)',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  // The --auto / discover path is the 5th wire site. Today
  // `runRegister(undefined, { auto: parent })` invokes `discoverProjects`
  // (which does NOT throw — it just scans) and then `registerInteractive`,
  // which internally calls `addProject`. We mock discoverProjects to a
  // single fake match so the loop reaches the mocked addProject.
  it('runRegister(--auto) exits(1) on registry_lock_timeout in discover loop', async () => {
    const { exitSpy } = mockExitAndStderr()
    vi.mocked(addProject).mockRejectedValue(lockTimeoutError())
    // Stub the discover step so registerInteractive is fed a single match.
    const discover = await import('./discover.js')
    vi.spyOn(discover, 'discoverProjects').mockReturnValue([
      { name: 'fake', root: '/tmp/fake', markers: ['CLAUDE.md'] },
    ])
    await expect(
      runRegister(undefined, { auto: '/tmp/parent', yes: true }),
    ).rejects.toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
