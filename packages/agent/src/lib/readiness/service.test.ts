import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHECK_IDS, FleetResponseSchema, RepoDetailResponseSchema } from '@agenticapps/dashboard-shared'

import {
  _resetReadinessCacheForTests,
  readFleet,
  readRepo,
  rescanRepo,
  type ReadinessScanOptions,
} from './service.js'

const NOW = 1_760_000_000_000

let sandbox: string
let family: string
let machine: string
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

function write(root: string, file: string, body = 'x\n'): void {
  mkdirSync(join(root, dirname(file)), { recursive: true })
  writeFileSync(join(root, file), body)
}

/** A git repo with one production file committed. */
function makeRepo(name: string, under = family): string {
  const root = join(under, name)
  mkdirSync(root, { recursive: true })
  git(root, ['init', '-b', 'main'])
  write(root, 'src/index.ts')
  git(root, ['add', '.'])
  git(root, ['commit', '-m', 'first'])
  return root
}

function registry(entries: { id: string; root: string; name?: string }[]): void {
  writeFileSync(
    registryFile,
    JSON.stringify({
      version: 1,
      projects: entries.map((entry) => ({
        id: entry.id,
        name: entry.name ?? entry.id,
        root: entry.root,
        client: null,
        addedAt: '2026-01-01T00:00:00.000Z',
        tags: [],
      })),
    }),
  )
}

const options = (over: Partial<ReadinessScanOptions> = {}): ReadinessScanOptions => ({
  registryFile,
  now: NOW,
  sourcecodeRoot: sandbox,
  machineSkillRoots: { codex: join(machine, 'codex', 'skills') },
  ...over,
})

beforeEach(() => {
  _resetReadinessCacheForTests()
  sandbox = mkdtempSync(join(tmpdir(), 'readiness-service-'))
  family = join(sandbox, 'agenticapps')
  machine = join(sandbox, 'machine')
  mkdirSync(family, { recursive: true })
  registryFile = join(sandbox, 'registry.json')
})

afterEach(() => {
  _resetReadinessCacheForTests()
  rmSync(sandbox, { recursive: true, force: true })
})

describe('readFleet', () => {
  it('returns one summary per registered repo, in registry order', async () => {
    const b = makeRepo('b-repo')
    const a = makeRepo('a-repo')
    registry([
      { id: 'b', root: b },
      { id: 'a', root: a },
    ])

    const fleet = await readFleet(options())

    expect(fleet.repos.map((repo) => repo.id)).toEqual(['b', 'a'])
  })

  it('answers the strict wire shape', async () => {
    registry([{ id: 'a', root: makeRepo('a-repo') }])

    expect(FleetResponseSchema.safeParse(await readFleet(options())).success).toBe(
      true,
    )
  })

  /**
   * The outage end to end, through the real assembler rather than a mocked
   * payload: one repo cites an evidence path that is legal and repo-relative but
   * whose own characters read as an absolute path. The notice and the check
   * error are both built from it, the fleet is validated as a single payload,
   * and before the guard could tell a citation from a leak this answered the
   * whole endpoint with `schema_drift` — taking `a-repo`, which has nothing
   * wrong with it, down alongside the repo that owns the bad filename.
   */
  it('answers the whole fleet when one repo cites a colon-bearing evidence path', async () => {
    const cited = 'docs/notes:/Users/x.md'
    const a = makeRepo('a-repo')
    const citing = makeRepo('citing-repo')
    write(
      citing,
      '.agenticapps/readiness.json',
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          {
            id: 'pen-test',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            validUntil: '2027-07-01T09:00:00Z',
            evidence: cited,
            commit: 'b'.repeat(40),
          },
        ],
      }),
    )
    git(citing, ['add', '.'])
    git(citing, ['commit', '-m', 'declare a colon-bearing citation'])
    registry([
      { id: 'a', root: a },
      { id: 'citing', root: citing },
    ])

    const fleet = await readFleet(options())

    expect(FleetResponseSchema.safeParse(fleet).success).toBe(true)
    expect(fleet.repos.map((repo) => repo.id)).toEqual(['a', 'citing'])

    const repo = fleet.repos[1]
    expect(repo?.notice?.message).toContain(cited)
    const penTest = repo?.checks.find((check) => check.id === 'pen-test')
    expect(penTest?.error?.code).toBe('evidence-unverifiable')
    expect(penTest?.error?.message).toContain(cited)
  })

  it('gives every repo six checks in the fixed order', async () => {
    registry([{ id: 'a', root: makeRepo('a-repo') }])

    const [repo] = (await readFleet(options())).repos

    expect(repo!.checks.map((check) => check.id)).toEqual([...CHECK_IDS])
  })

  it('reads the family from the repo root', async () => {
    const inside = makeRepo('a-repo')
    const outside = makeRepo('loose-repo', sandbox)
    registry([
      { id: 'a', root: inside },
      { id: 'loose', root: outside },
    ])

    const fleet = await readFleet(options())

    expect(fleet.repos.map((repo) => repo.family)).toEqual(['agenticapps', 'other'])
  })

  it('carries the last committer time', async () => {
    registry([{ id: 'a', root: makeRepo('a-repo') }])

    const [repo] = (await readFleet(options())).repos

    expect(repo!.lastCommitAt).toEqual(expect.any(Number))
  })

  it('returns an empty fleet for an empty registry', async () => {
    registry([])

    const fleet = await readFleet(options())

    expect(fleet.repos).toEqual([])
    expect(fleet.generatedAt).toBe(NOW)
  })

  describe('degrading per repo', () => {
    it('keeps every other repo when one cannot be read at all', async () => {
      const good = makeRepo('good-repo')
      registry([
        { id: 'gone', root: join(family, 'not-here') },
        { id: 'good', root: good },
      ])

      const fleet = await readFleet(options())

      expect(fleet.repos.map((repo) => repo.id)).toEqual(['gone', 'good'])
    })

    it('reports the unreadable repo as six error-bearing fails', async () => {
      registry([{ id: 'gone', root: join(family, 'not-here') }])

      const [repo] = (await readFleet(options())).repos

      expect(repo!.checks).toHaveLength(6)
      for (const check of repo!.checks) {
        expect(check.status).toBe('fail')
        expect(check.error).not.toBeNull()
      }
      expect(repo!.ready).toBe(false)
    })

    it('still returns six checks for a directory that is not a git repo', async () => {
      const bare = join(family, 'bare')
      mkdirSync(bare, { recursive: true })
      registry([{ id: 'bare', root: bare }])

      const [repo] = (await readFleet(options())).repos

      expect(repo!.checks).toHaveLength(6)
    })
  })

  describe('the trust boundary', () => {
    it('serialises no machine path', async () => {
      registry([{ id: 'a', root: makeRepo('a-repo') }])

      const body = JSON.stringify(await readFleet(options()))

      expect(body).not.toContain(sandbox)
      expect(body).not.toContain(tmpdir())
    })

    it('writes nothing into the repo it reads', async () => {
      const root = makeRepo('a-repo')
      registry([{ id: 'a', root }])
      const before = readdirSync(root).sort()

      await readFleet(options())

      expect(readdirSync(root).sort()).toEqual(before)
    })
  })
})

describe('the five-second memo', () => {
  beforeEach(() => registry([{ id: 'a', root: makeRepo('a-repo') }]))

  it('replays the snapshot inside the window', async () => {
    const first = await readFleet(options({ now: NOW }))
    const second = await readFleet(options({ now: NOW + 4_000 }))

    expect(second.generatedAt).toBe(first.generatedAt)
  })

  it('recomputes once the window has passed', async () => {
    await readFleet(options({ now: NOW }))
    const later = await readFleet(options({ now: NOW + 5_001 }))

    expect(later.generatedAt).toBe(NOW + 5_001)
  })

  it('recomputes inside the window when HEAD moves', async () => {
    await readFleet(options({ now: NOW }))
    const root = join(family, 'a-repo')
    write(root, 'src/other.ts')
    git(root, ['add', '.'])
    git(root, ['commit', '-m', 'second'])

    expect((await readFleet(options({ now: NOW + 1_000 }))).generatedAt).toBe(
      NOW + 1_000,
    )
  })

  it('recomputes inside the window when the working tree goes dirty', async () => {
    await readFleet(options({ now: NOW }))
    write(join(family, 'a-repo'), 'src/index.ts', 'changed\n')

    expect((await readFleet(options({ now: NOW + 1_000 }))).generatedAt).toBe(
      NOW + 1_000,
    )
  })

  it('recomputes inside the window when a repo joins the registry', async () => {
    const first = await readFleet(options({ now: NOW }))
    registry([
      { id: 'a', root: join(family, 'a-repo') },
      { id: 'b', root: makeRepo('b-repo') },
    ])
    const second = await readFleet(options({ now: NOW + 1_000 }))

    expect(second.repos).toHaveLength(2)
    expect(second.generatedAt).not.toBe(first.generatedAt)
  })

  it('dates the fleet by its oldest snapshot, not by the moment it was served', async () => {
    registry([
      { id: 'a', root: join(family, 'a-repo') },
      { id: 'b', root: makeRepo('b-repo') },
    ])
    await readFleet(options({ now: NOW }))
    // Only b changes, so a is replayed from the memo and the fleet is as old as a.
    write(join(family, 'b-repo'), 'src/index.ts', 'changed\n')

    expect((await readFleet(options({ now: NOW + 2_000 }))).generatedAt).toBe(NOW)
  })
})

describe('readRepo', () => {
  beforeEach(() => registry([{ id: 'a', root: makeRepo('a-repo') }]))

  it('answers the strict detail wire shape', async () => {
    expect(
      RepoDetailResponseSchema.safeParse(await readRepo('a', options())).success,
    ).toBe(true)
  })

  it('gives every check a remedy', async () => {
    const detail = await readRepo('a', options())

    for (const check of detail!.repo.checks) {
      expect(check.remedy.trim()).not.toBe('')
    }
  })

  it('wires each remedy to its own check rather than one placeholder', async () => {
    const detail = await readRepo('a', options())
    const remedies = detail!.repo.checks.map((check) => check.remedy)

    expect(new Set(remedies).size).toBe(6)
    expect(
      detail!.repo.checks.find((check) => check.id === 'pen-test')!.remedy,
    ).toContain('.agenticapps/readiness.json')
  })

  it('names the detected host in the remedy it renders', async () => {
    const root = join(family, 'claude-repo')
    mkdirSync(join(root, '.claude'), { recursive: true })
    registry([{ id: 'c', root }])

    const detail = await readRepo('c', options())

    expect(detail!.repo.checks.find((check) => check.id === 'spec')!.remedy).toContain(
      '/update-agenticapps-workflow',
    )
  })

  it('returns null for an unknown id', async () => {
    expect(await readRepo('nobody', options())).toBeNull()
  })

  it('shares one snapshot with the fleet rather than recomputing', async () => {
    const fleet = await readFleet(options({ now: NOW }))
    const detail = await readRepo('a', options({ now: NOW + 1_000 }))

    expect(detail!.generatedAt).toBe(fleet.generatedAt)
  })
})

describe('rescanRepo', () => {
  beforeEach(() =>
    registry([
      { id: 'a', root: makeRepo('a-repo') },
      { id: 'b', root: makeRepo('b-repo') },
    ]),
  )

  it('discards the cached snapshot and recomputes inside the window', async () => {
    await readFleet(options({ now: NOW }))

    const rescanned = await rescanRepo('a', options({ now: NOW + 1_000 }))

    expect(rescanned!.generatedAt).toBe(NOW + 1_000)
  })

  it('leaves the other repos cached', async () => {
    await readFleet(options({ now: NOW }))
    await rescanRepo('a', options({ now: NOW + 1_000 }))

    const fleet = await readFleet(options({ now: NOW + 2_000 }))
    const b = fleet.repos.find((repo) => repo.id === 'b')

    expect(b).toBeDefined()
    expect(fleet.generatedAt).toBe(NOW)
  })

  it('returns null for an unknown id without reading a path from the request', async () => {
    expect(await rescanRepo('../../etc', options())).toBeNull()
  })

  // Coalescing must not swallow the force. A read that is already in flight was
  // started with force=false, so joining it hands the rescan whatever the cache
  // already held — the route answers 200 and rescans nothing. The window is real:
  // resolveSnapshot awaits the git fingerprint before it consults the cache, so a
  // click on Rescan while the page is still loading lands inside it.
  it('does not let a rescan join an in-flight read and skip the recomputation', async () => {
    await readFleet(options({ now: NOW }))

    const read = readRepo('a', options({ now: NOW + 1_000 }))
    const rescanned = await rescanRepo('a', options({ now: NOW + 2_000 }))
    await read

    expect(rescanned!.generatedAt).toBe(NOW + 2_000)
  })

  // Coalescing keys on the repo id, but the id is a registry label — the thing
  // actually scanned is the root behind it. When a repo is repointed while a
  // computation for that id is in flight, the second request must not be handed
  // the first one's answer about the old directory.
  it('does not coalesce two rescans of the same id across a repointed root', async () => {
    const moved = makeRepo('a-moved')

    const first = rescanRepo('a', options({ now: NOW }))
    registry([{ id: 'a', root: moved }, { id: 'b', root: makeRepo('b-kept') }])
    const second = await rescanRepo('a', options({ now: NOW + 3_000 }))
    await first

    expect(second!.generatedAt).toBe(NOW + 3_000)
  })

  // The counterweight to the repointed-root test above. Keying the in-flight
  // slot on anything that is not the repo — the fleet signature, say — means an
  // unrelated repo joining the registry gives this repo a different key, and the
  // same root is then scanned twice at once.
  it('still coalesces when an unrelated repo changes the fleet mid-flight', async () => {
    const root = makeRepo('a-pinned')
    registry([{ id: 'a', root }])

    const first = rescanRepo('a', options({ now: NOW }))
    // Same repo, same root — only the fleet around it changes.
    registry([{ id: 'a', root }, { id: 'c', root: makeRepo('c-repo') }])
    const second = await rescanRepo('a', options({ now: NOW + 3_000 }))

    expect(second!.generatedAt).toBe((await first)!.generatedAt)
  })

  it('coalesces concurrent rescans into one computation', async () => {
    const [first, second] = await Promise.all([
      rescanRepo('a', options({ now: NOW })),
      rescanRepo('a', options({ now: NOW + 3_000 })),
    ])

    // Two computations would stamp two different times, so one shared time is
    // the evidence that only one ran. The times are deliberately 3s apart:
    // with equal times this assertion would also hold for two computations and
    // would detect nothing.
    expect(second!.generatedAt).toBe(first!.generatedAt)

    // WHICH of the two it is, is not part of the contract. `detailFor` awaits
    // `signatureFor` before `snapshotFor` registers the in-flight entry, so the
    // two callers interleave at that await and either may install it — this
    // asserted `NOW` and flaked on roughly one run in three. Both callers are
    // concurrent by definition, so either stamp is honest; what must never
    // happen is a third time, which would mean a recomputation nobody asked for.
    expect([NOW, NOW + 3_000]).toContain(first!.generatedAt)
  })
})

describe('the workflow check wiring', () => {
  /** The host repos come from the family root, never from a caller-supplied path. */
  const skill = (version: string, implementsSpec: string): string =>
    `---\nname: agentic-apps-workflow\nversion: ${version}\nimplements_spec: ${implementsSpec}\ndescription: x\n---\n\nbody\n`

  function shipClaudeHost(version: string, implementsSpec: string): void {
    write(join(family, 'claude-workflow'), join('skill', 'SKILL.md'), skill(version, implementsSpec))
  }

  it('resolves the host repo from the family root', async () => {
    const root = makeRepo('a-repo')
    write(
      root,
      join('.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
      skill('1.0.0', '1.0.0'),
    )
    git(root, ['add', '.'])
    git(root, ['commit', '-m', 'workflow'])
    shipClaudeHost('1.0.0', '1.0.0')
    registry([{ id: 'a', root }])

    const [repo] = (await readFleet(options())).repos
    const workflow = repo!.checks.find((check) => check.id === 'workflow')

    expect(workflow!.status).toBe('ok')
  })

  it('reports an unpinnable host as not applicable', async () => {
    const root = makeRepo('a-repo')
    mkdirSync(join(root, '.pi'), { recursive: true })
    registry([{ id: 'a', root }])

    const [repo] = (await readFleet(options())).repos
    const workflow = repo!.checks.find((check) => check.id === 'workflow')

    expect(workflow!.status).toBe('na')
  })
})
