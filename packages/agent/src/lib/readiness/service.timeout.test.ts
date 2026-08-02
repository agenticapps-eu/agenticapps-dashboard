/**
 * The per-repo time bound on fleet assembly.
 *
 * `Promise.allSettled` survives rejection, not a hang: a repo whose scan never
 * settles used to withhold the entire fleet response. Every subprocess in a scan
 * is bounded, but no filesystem call is, so a substituted FIFO or a hung mount
 * can block an `open` indefinitely.
 *
 * The hang is injected by mocking the fingerprint module rather than by opening a
 * real FIFO: the requirement is about the bound, and a real blocking primitive
 * would make the test POSIX-only and slow without testing anything more. What
 * matters is that a promise which never settles is survivable.
 *
 * Lives in its own file because the module mock would otherwise apply to every
 * test in the service suite.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { FleetResponseSchema } from '@agenticapps/dashboard-shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetReadinessCacheForTests, readFleet } from './service.js'

/** Roots whose fingerprint call blocks until `release()` is called. */
const blocked = new Set<string>()
const releases: (() => void)[] = []
/** Resolves every blocked fingerprint, standing in for the OS unblocking. */
const release = (): void => {
  for (const fn of releases.splice(0)) fn()
}
/** How many times a fingerprint was actually computed, per root. */
const fingerprintCalls = new Map<string, number>()
/** Set while the fleet-wide signature should never settle. */
let signatureHangs = false

vi.mock('./fingerprint.js', async (importActual) => {
  const actual = await importActual<typeof import('./fingerprint.js')>()
  return {
    ...actual,
    repoFingerprint: (root: string, fleet: string) => {
      fingerprintCalls.set(root, (fingerprintCalls.get(root) ?? 0) + 1)
      if (!blocked.has(root)) return actual.repoFingerprint(root, fleet)
      return new Promise<string>((resolve) => {
        releases.push(() => {
          blocked.delete(root)
          resolve('fingerprint-after-unblock')
        })
      })
    },
    fleetSignature: (...args: Parameters<typeof actual.fleetSignature>) =>
      signatureHangs
        ? new Promise<string>(() => {})
        : actual.fleetSignature(...args),
  }
})

const NOW = 1_760_000_000_000
/** Short enough to keep the suite fast, long enough that a real scan beats it. */
const BOUND = 2_000

let sandbox: string
let family: string
let registryFile: string

function git(root: string, args: string[]): string {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@test.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd: root, encoding: 'utf8' },
  )
}

function makeRepo(name: string): string {
  const root = join(family, name)
  mkdirSync(join(root, dirname('src/index.ts')), { recursive: true })
  git(root, ['init', '-b', 'main'])
  writeFileSync(join(root, 'src', 'index.ts'), 'x\n')
  git(root, ['add', '.'])
  git(root, ['commit', '-m', 'first'])
  return root
}

function registry(entries: { id: string; root: string }[]): void {
  writeFileSync(
    registryFile,
    JSON.stringify({
      version: 1,
      projects: entries.map((entry) => ({
        id: entry.id,
        name: entry.id,
        root: entry.root,
        client: null,
        addedAt: '2026-01-01T00:00:00.000Z',
        tags: [],
      })),
    }),
  )
}

const options = () => ({
  registryFile,
  now: NOW,
  sourcecodeRoot: sandbox,
  machineSkillRoots: {},
  scanTimeoutMs: BOUND,
})

beforeEach(() => {
  _resetReadinessCacheForTests()
  blocked.clear()
  releases.length = 0
  fingerprintCalls.clear()
  signatureHangs = false
  sandbox = mkdtempSync(join(tmpdir(), 'readiness-timeout-'))
  family = join(sandbox, 'agenticapps')
  mkdirSync(family, { recursive: true })
  registryFile = join(sandbox, 'registry.json')
})

afterEach(() => {
  release()
  _resetReadinessCacheForTests()
  blocked.clear()
  fingerprintCalls.clear()
  signatureHangs = false
  rmSync(sandbox, { recursive: true, force: true })
})

describe('readFleet — the per-repo time bound', () => {
  it('answers with every other repo when one scan never settles', async () => {
    const stuck = makeRepo('stuck-repo')
    const healthy = makeRepo('healthy-repo')
    registry([
      { id: 'stuck', root: stuck },
      { id: 'healthy', root: healthy },
    ])
    blocked.add(stuck)

    const fleet = await readFleet(options())

    expect(fleet.repos.map((repo) => repo.id)).toEqual(['stuck', 'healthy'])
    expect(FleetResponseSchema.safeParse(fleet).success).toBe(true)
  })

  it('reports the blocked repo in the shape a rejecting repo gets', async () => {
    const stuck = makeRepo('stuck-repo')
    registry([{ id: 'stuck', root: stuck }])
    blocked.add(stuck)

    const [repo] = (await readFleet(options())).repos

    expect(repo!.ready).toBe(false)
    expect(repo!.checks).toHaveLength(6)
    expect(repo!.checks.every((check) => check.status === 'fail')).toBe(true)
    expect(repo!.checks.every((check) => check.error !== null)).toBe(true)
  })

  it('still answers when the fleet-wide signature never settles', async () => {
    registry([{ id: 'a', root: makeRepo('a-repo') }])
    signatureHangs = true

    const fleet = await readFleet(options())

    // The bound covers the work that precedes per-repo assembly, so the response
    // arrives rather than waiting indefinitely before any repo is scanned.
    expect(fleet.repos).toHaveLength(1)
    expect(FleetResponseSchema.safeParse(fleet).success).toBe(true)
  })

  // The bound governs how long the endpoint waits, not what the repo *is*.
  // Recording the expiry as a snapshot would leave the repo suppressed for the
  // memo's lifetime even after the block cleared.
  it('does not remember a timeout as a result once the block clears', async () => {
    const stuck = makeRepo('stuck-repo')
    registry([{ id: 'stuck', root: stuck }])
    blocked.add(stuck)

    const first = (await readFleet(options())).repos[0]!
    expect(first.checks.every((check) => check.error !== null)).toBe(true)

    // Stands in for the OS releasing the blocked call. The joined computation
    // settles, and the repo recovers on its own.
    release()
    await vi.waitFor(async () => {
      const repo = (await readFleet(options())).repos[0]!
      expect(repo.checks.some((check) => check.error === null)).toBe(true)
    })
  }, 20_000)

  // A blocked filesystem call cannot be cancelled, so abandoning the computation
  // and starting a fresh one on the next poll would block in turn — converting
  // one stuck repo into an unbounded accumulation of stuck work. Coalescing is
  // what keeps the cost at one blocked computation however often we are called.
  it('does not start a second scan of a repo already blocked', async () => {
    const stuck = makeRepo('stuck-repo')
    registry([{ id: 'stuck', root: stuck }])
    blocked.add(stuck)

    await readFleet(options())
    await readFleet(options())
    await readFleet(options())

    expect(fingerprintCalls.get(stuck)).toBe(1)

    // Leave nothing pending for the next test.
    release()
    // Three bounded waits in sequence outlast the default per-test timeout.
  }, 20_000)
})
