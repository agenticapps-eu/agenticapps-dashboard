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
 * Also covers WR-05: runUnregister evicts panel caches on successful removal
 * so stale cache entries are not served under a re-registered project at the
 * same path (ids are reusable slugs, not UUIDs).
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
    readRegistry: vi.fn().mockReturnValue({ projects: [] }),
  }
})

vi.mock('../lib/auth.js', () => ({
  ensureAuthFile: vi.fn(),
}))

vi.mock('../routes/sentry.js', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return { ...actual, evictSentryCacheProject: vi.fn() }
})

vi.mock('../routes/linear.js', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return { ...actual, evictLinearCacheProject: vi.fn() }
})

vi.mock('../routes/integrations.js', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return { ...actual, evictIntegrationsCacheProject: vi.fn() }
})

import { addProject, removeProject, renameProject, setTags, readRegistry } from '../lib/registry.js'
import { evictSentryCacheProject } from '../routes/sentry.js'
import { evictLinearCacheProject } from '../routes/linear.js'
import { evictIntegrationsCacheProject } from '../routes/integrations.js'
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

// WR-05: runUnregister must evict panel caches on successful removal.
// Project ids are slug-based (not UUIDs) and CAN be reused if a project at
// the same path is re-registered — stale cache entries would otherwise be
// served under the new registration.
describe('WR-05: runUnregister evicts panel caches on successful removal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('WR-05: evicts sentry, linear, and integrations caches for the removed project id', async () => {
    const { exitSpy } = mockExitAndStderr()

    // Seed readRegistry to return a project with known id
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [
        {
          id: 'my-project',
          name: 'My Project',
          root: '/home/user/my-project',
          client: null,
          addedAt: '2026-06-11T00:00:00Z',
          tags: [],
        },
      ],
    } as ReturnType<typeof readRegistry>)

    // removeProject returns true (successful removal)
    vi.mocked(removeProject).mockResolvedValue(true)

    await expect(runUnregister('my-project')).rejects.toThrow('process.exit(0)')
    expect(exitSpy).toHaveBeenCalledWith(0)

    // All three eviction functions must have been called with the resolved id
    expect(vi.mocked(evictSentryCacheProject)).toHaveBeenCalledWith('my-project')
    expect(vi.mocked(evictLinearCacheProject)).toHaveBeenCalledWith('my-project')
    expect(vi.mocked(evictIntegrationsCacheProject)).toHaveBeenCalledWith('my-project')
  })

  it('WR-05b: eviction functions NOT called when project is not found (removal returns false)', async () => {
    mockExitAndStderr()

    vi.mocked(readRegistry).mockReturnValue({ version: 1, projects: [] } as ReturnType<typeof readRegistry>)
    vi.mocked(removeProject).mockResolvedValue(false)

    await expect(runUnregister('nonexistent-id')).rejects.toThrow('process.exit(1)')

    // No eviction when nothing was removed
    expect(vi.mocked(evictSentryCacheProject)).not.toHaveBeenCalled()
    expect(vi.mocked(evictLinearCacheProject)).not.toHaveBeenCalled()
    expect(vi.mocked(evictIntegrationsCacheProject)).not.toHaveBeenCalled()
  })
})
