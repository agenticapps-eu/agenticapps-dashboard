/**
 * OpenSpec CLI invocation discipline — filesystem-access-policy spawn site 3.
 *
 * These tests use real executable scripts on disk rather than mocks: the
 * requirement is about how a process is spawned and bounded, and a mock of
 * execa would assert our belief about spawning instead of the spawning itself.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { realpath } from 'node:fs/promises'
import { join, delimiter } from 'node:path'

import { describe, it, expect, afterEach } from 'vitest'

import {
  resolveOpenspecBinary,
  getOpenspecBinary,
  __resetOpenspecBinaryForTests,
  runOpenspecList,
  OPENSPEC_MAX_OUTPUT_BYTES,
} from './openspecCli.js'

const cleanups: Array<() => void> = []

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

function tmp(prefix = 'openspec-cli-'): string {
  const d = mkdtempSync(join(tmpdir(), prefix))
  cleanups.push(() => rmSync(d, { recursive: true, force: true }))
  return d
}

/** Write an executable shell script and return its absolute path. */
function makeBin(dir: string, name: string, body: string): string {
  const p = join(dir, name)
  writeFileSync(p, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
  chmodSync(p, 0o755)
  return p
}

describe('resolveOpenspecBinary', () => {
  it('returns an absolute path for a regular executable on PATH', async () => {
    const dir = tmp()
    makeBin(dir, 'openspec', 'echo "{}"')
    const resolved = await resolveOpenspecBinary({ PATH: dir })
    expect(resolved).toBe(join(dir, 'openspec'))
  })

  it('returns null when the binary is absent from PATH', async () => {
    const dir = tmp()
    expect(await resolveOpenspecBinary({ PATH: dir })).toBeNull()
  })

  it('returns null when the candidate is a directory', async () => {
    const dir = tmp()
    mkdirSync(join(dir, 'openspec'))
    expect(await resolveOpenspecBinary({ PATH: dir })).toBeNull()
  })

  it('returns null when the candidate is a broken symlink', async () => {
    const dir = tmp()
    symlinkSync(join(dir, 'does-not-exist'), join(dir, 'openspec'))
    expect(await resolveOpenspecBinary({ PATH: dir })).toBeNull()
  })

  it('returns null when the candidate is not executable', async () => {
    const dir = tmp()
    const p = join(dir, 'openspec')
    writeFileSync(p, '#!/bin/sh\necho {}\n', { mode: 0o644 })
    chmodSync(p, 0o644)
    expect(await resolveOpenspecBinary({ PATH: dir })).toBeNull()
  })

  it('returns null for an empty or unset PATH rather than searching the cwd', async () => {
    expect(await resolveOpenspecBinary({ PATH: '' })).toBeNull()
    expect(await resolveOpenspecBinary({})).toBeNull()
  })
})

describe('runOpenspecList — argv discipline', () => {
  it('invokes the fixed argv for changes and for specs', async () => {
    const dir = tmp()
    const out = tmp()
    // Record argv exactly as the child received it.
    const bin = makeBin(dir, 'openspec', `printf '%s\\n' "$@" > "${join(out, 'argv.txt')}"; echo '{"changes":[]}'`)

    await runOpenspecList('changes', out, bin)
    const changesArgv = (await import('node:fs')).readFileSync(join(out, 'argv.txt'), 'utf8')
    expect(changesArgv.trim().split('\n')).toEqual(['list', '--json'])

    await runOpenspecList('specs', out, bin)
    const specsArgv = (await import('node:fs')).readFileSync(join(out, 'argv.txt'), 'utf8')
    expect(specsArgv.trim().split('\n')).toEqual(['list', '--specs', '--json'])
  })

  it('passes a cwd containing shell metacharacters without interpretation', async () => {
    const dir = tmp()
    const parent = tmp()
    // A directory name that a shell would mangle: spaces, quote, $, ;, &
    const nasty = join(parent, `a b'c $HOME; rm -rf . & d`)
    mkdirSync(nasty, { recursive: true })
    const bin = makeBin(dir, 'openspec', `printf '%s' "$PWD" > "${join(parent, 'pwd.txt')}"; echo '{"changes":[]}'`)

    const res = await runOpenspecList('changes', nasty, bin)
    expect(res.ok).toBe(true)
    const seen = (await import('node:fs')).readFileSync(join(parent, 'pwd.txt'), 'utf8')
    // Compare realpaths: on macOS /var is a symlink to /private/var, so $PWD in
    // the child is the resolved form. The point of the assertion is that the
    // whole nasty directory name arrived intact, not which alias it took.
    expect(await realpath(seen)).toBe(await realpath(nasty))
  })
})

describe('runOpenspecList — bounds and fallback', () => {
  it('reports unavailable without spawning when no binary is resolved', async () => {
    const res = await runOpenspecList('changes', tmp(), null)
    expect(res).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('falls back on a spawn failure when the binary vanished after resolution', async () => {
    const dir = tmp()
    const bin = makeBin(dir, 'openspec', 'echo "{}"')
    rmSync(bin)
    const res = await runOpenspecList('changes', tmp(), bin)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('spawn-failed')
  })

  it('falls back on a non-zero exit', async () => {
    const dir = tmp()
    const bin = makeBin(dir, 'openspec', 'echo "boom" >&2; exit 3')
    const res = await runOpenspecList('changes', tmp(), bin)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('exit')
  })

  it('falls back on a timeout and does not hang', async () => {
    const dir = tmp()
    const bin = makeBin(dir, 'openspec', 'sleep 30')
    const res = await runOpenspecList('changes', tmp(), bin, { timeoutMs: 300 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('timeout')
  }, 10_000)

  it('falls back on unparseable JSON', async () => {
    const dir = tmp()
    const bin = makeBin(dir, 'openspec', 'echo "not json at all"')
    const res = await runOpenspecList('changes', tmp(), bin)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('unparseable')
  })

  it('falls back on JSON whose shape is missing a consumed field', async () => {
    const dir = tmp()
    // `name` present, `totalTasks` missing — a plausible older CLI.
    const bin = makeBin(dir, 'openspec', `echo '{"changes":[{"name":"a","completedTasks":0}]}'`)
    const res = await runOpenspecList('changes', tmp(), bin)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('unrecognised')
  })

  it('accepts JSON carrying unknown extra fields (forward compatible)', async () => {
    const dir = tmp()
    const bin = makeBin(
      dir,
      'openspec',
      `echo '{"changes":[{"name":"a","completedTasks":1,"totalTasks":4,"futureField":"x"}],"topLevelExtra":9}'`,
    )
    const res = await runOpenspecList('changes', tmp(), bin)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data).toEqual([{ name: 'a', completedTasks: 1, totalTasks: 4 }])
    }
  })

  it('falls back when output exceeds the cap', async () => {
    const dir = tmp()
    const bin = makeBin(
      dir,
      'openspec',
      `yes "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" | head -c ${OPENSPEC_MAX_OUTPUT_BYTES + 1024}`,
    )
    const res = await runOpenspecList('changes', tmp(), bin, { timeoutMs: 5_000 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('oversized')
  }, 15_000)

  it('parses a well-formed specs listing', async () => {
    const dir = tmp()
    const bin = makeBin(
      dir,
      'openspec',
      `echo '{"specs":[{"id":"daemon-runtime","requirementCount":9},{"id":"help-docs","requirementCount":4}]}'`,
    )
    const res = await runOpenspecList('specs', tmp(), bin)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data).toEqual([
        { id: 'daemon-runtime', requirementCount: 9 },
        { id: 'help-docs', requirementCount: 4 },
      ])
    }
  })
})

/*
 * `OpenSpec CLI Invocation Discipline` requires the binary be resolved once and
 * never re-looked-up on the request path: "no PATH lookup and no process spawn
 * is attempted on the request path."
 *
 * That is not only a cost rule. A PATH walk per request means a local attacker
 * who can write to any writable PATH directory has their binary picked up
 * within one poll interval, with no daemon restart. Resolving once narrows the
 * window to daemon start, where a restart is at least observable.
 *
 * The observable consequence of memoisation is that a binary deleted after
 * resolution still yields the resolved path — the disappearance is then handled
 * as a spawn failure, which the spec separately requires to fall back to the
 * tree rather than error.
 */
describe('getOpenspecBinary — resolved once, never re-walked per request', () => {
  afterEach(() => __resetOpenspecBinaryForTests())

  it('does not re-walk PATH after the first resolution', async () => {
    __resetOpenspecBinaryForTests()
    const dir = tmp()
    const bin = makeBin(dir, 'openspec', 'echo "{}"')

    const first = await getOpenspecBinary({ PATH: dir })
    expect(first).toBe(bin)

    // Remove the binary. A per-request PATH walk would now return null; a
    // resolve-once accessor still reports the path it resolved at start.
    rmSync(bin, { force: true })
    expect(await resolveOpenspecBinary({ PATH: dir })).toBeNull()
    expect(await getOpenspecBinary({ PATH: dir })).toBe(bin)
  })

  it('caches a resolution failure too, so absence costs no repeat lookup', async () => {
    __resetOpenspecBinaryForTests()
    const dir = tmp()

    expect(await getOpenspecBinary({ PATH: dir })).toBeNull()

    // Planting a binary after the daemon resolved must NOT be picked up.
    makeBin(dir, 'openspec', 'echo "{}"')
    expect(await getOpenspecBinary({ PATH: dir })).toBeNull()
  })

  it('returns the same promise-resolved value to concurrent callers', async () => {
    __resetOpenspecBinaryForTests()
    const dir = tmp()
    const bin = makeBin(dir, 'openspec', 'echo "{}"')

    const [a, b, c] = await Promise.all([
      getOpenspecBinary({ PATH: dir }),
      getOpenspecBinary({ PATH: dir }),
      getOpenspecBinary({ PATH: dir }),
    ])
    expect([a, b, c]).toEqual([bin, bin, bin])
  })
})

/*
 * These two guards decide which binary the daemon executes. The pre-existing
 * "empty or unset PATH" case never reached them: both `PATH: ''` and `{}`
 * short-circuit at `if (!pathVar) return null`. Deleting `if (!entry) continue`
 * broke no test, and the daemon would have executed ./openspec from its own cwd.
 */
describe('resolveOpenspecBinary — PATH element guards', () => {
  it('never searches the cwd for an empty PATH element', async () => {
    const dir = tmp()
    const cwdDir = tmp()
    makeBin(cwdDir, 'openspec', 'echo "{}"')
    const prev = process.cwd()
    process.chdir(cwdDir)
    try {
      // A leading delimiter is the POSIX "current directory" element.
      expect(await resolveOpenspecBinary({ PATH: `${delimiter}${dir}` })).toBeNull()
    } finally {
      process.chdir(prev)
    }
  })

  it('ignores a relative PATH element', async () => {
    const cwdDir = tmp()
    mkdirSync(join(cwdDir, 'bin'), { recursive: true })
    makeBin(join(cwdDir, 'bin'), 'openspec', 'echo "{}"')
    const prev = process.cwd()
    process.chdir(cwdDir)
    try {
      expect(await resolveOpenspecBinary({ PATH: 'bin' })).toBeNull()
    } finally {
      process.chdir(prev)
    }
  })
})
