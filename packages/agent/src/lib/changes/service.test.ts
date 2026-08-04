/**
 * service.test.ts — fleet assembly, degradation, ordering and the cache.
 *
 * The degradation cases are the point of the file. `repo-readiness` learned
 * that a fleet endpoint which drops a repository silently reads as a fleet with
 * nothing in it, so every case here asserts both halves: what still rendered,
 * and what was named as lost.
 */
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChangesFleetResponseSchema, cardKey, fleetReadState } from '@agenticapps/dashboard-shared'

import {
  CHANGES_MEMO_TTL_MS,
  _resetChangesCacheForTests,
  invalidateChangesCache,
  readChangesFleet,
} from './service.js'

const temps: string[] = []
afterEach(async () => {
  _resetChangesCacheForTests()
  vi.restoreAllMocks()
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function makeRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'change-fleet-'))
  temps.push(root)
  for (const [path, contents] of Object.entries(files)) {
    const absolute = join(root, path)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, contents)
  }
  return root
}

const changeFiles = (dir: string) => ({
  [`${dir}/proposal.md`]: '# why\n',
  [`${dir}/tasks.md`]: '- [ ] a\n',
  [`${dir}/specs/thing/spec.md`]: '#\n',
})

/** A registry file naming the given roots, as the daemon would hold it. */
async function makeRegistry(entries: { id: string; name: string; root: string }[]) {
  const dir = await mkdtemp(join(tmpdir(), 'change-registry-'))
  temps.push(dir)
  const file = join(dir, 'registry.json')
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      projects: entries.map((entry) => ({
        ...entry,
        client: null,
        addedAt: '2026-08-03T00:00:00.000Z',
        tags: [],
      })),
    }),
  )
  return file
}

describe('a repository whose openspec anchor escapes its root', () => {
  it('is reported as failed rather than as a repository with nothing in it', async () => {
    // The distinction the whole degradation design exists for: a refused read
    // and an empty corpus must not render the same. Before this was reported,
    // an escaped anchor produced `read: 'ok'` with zero cards and zero notices
    // — byte-identical to a repository with no `openspec/` at all.
    const outside = await makeRepo(changeFiles('changes/leaked-change'))
    const root = await mkdtemp(join(tmpdir(), 'change-fleet-'))
    temps.push(root)
    await symlink(outside, join(root, 'openspec'), 'dir')
    const healthy = await makeRepo(changeFiles('openspec/changes/add-thing'))

    const file = await makeRegistry([
      { id: 'escaped', name: 'escaped', root },
      { id: 'healthy', name: 'healthy', root: healthy },
    ])
    const response = await readChangesFleet({ registryFile: file })

    expect(response.repositories).toContainEqual({
      id: 'escaped', name: 'escaped', read: 'failed', reason: 'unreadable',
    })
    expect(response.cards.map((card) => card.changeName)).toEqual(['add-thing'])
    // One repository refused, one read: the board is degraded, not empty.
    expect(fleetReadState(response)).toBe('degraded')
  })
})

describe('readChangesFleet', () => {
  it('returns the strict wire shape', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const response = await readChangesFleet({ registryFile })
    expect(ChangesFleetResponseSchema.safeParse(response).success).toBe(true)
    expect(response.cards.map((card) => card.changeName)).toEqual(['add-thing'])
  })

  it('carries each card’s repository and the NUL-joined identity', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const card = (await readChangesFleet({ registryFile })).cards[0]!
    expect(card.repositoryId).toBe('p1')
    expect(card.repositoryName).toBe('one')
    expect(card.id).toBe(cardKey('p1', 'active', 'add-thing'))
  })

  it('classifies each card through the stage machine', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/incomplete'),
      ...changeFiles('openspec/changes/archive/2026-07-04-filed'),
      'openspec/BACKLOG.md': '## Unstarted work\n\nbody\n',
    })
    await rm(join(root, 'openspec/changes/incomplete/tasks.md'))
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const byName = new Map(
      (await readChangesFleet({ registryFile })).cards.map((card) => [card.changeName, card]),
    )
    expect(byName.get('incomplete')!.stage).toBe('propose')
    expect(byName.get('filed')!.stage).toBe('archive')
    expect(byName.get('filed')!.ready).toBe(false)
    expect(byName.get('unstarted-work')!.stage).toBe('propose')
  })

  it('attaches the repository to every notice', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/archive/nope'),
    })
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const { notices } = await readChangesFleet({ registryFile })
    expect(notices.length).toBeGreaterThan(0)
    for (const notice of notices) {
      expect(notice.repositoryId).toBe('p1')
      expect(notice.repositoryName).toBe('one')
    }
  })

  it('reads every registered repository and no others', async () => {
    const registered = await makeRepo(changeFiles('openspec/changes/in-the-registry'))
    const unregistered = await makeRepo(changeFiles('openspec/changes/not-registered'))
    expect(unregistered).toBeTruthy()
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root: registered }])

    const { cards } = await readChangesFleet({ registryFile })
    expect(cards.map((card) => card.changeName)).toEqual(['in-the-registry'])
  })

  it('answers an empty registry with an empty, non-degraded board', async () => {
    const registryFile = await makeRegistry([])
    const response = await readChangesFleet({ registryFile })

    expect(response.cards).toEqual([])
    expect(response.repositories).toEqual([])
    expect(fleetReadState(response)).toBe('empty')
  })
})

// ── 4.1 one repository fails, the rest still render ─────────────────────────

describe('degradation', () => {
  it('renders the readable repositories and names the unreachable one', async () => {
    const good = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const registryFile = await makeRegistry([
      { id: 'p1', name: 'good', root: good },
      { id: 'p2', name: 'gone', root: join(tmpdir(), 'no-such-directory-for-the-board') },
    ])

    const response = await readChangesFleet({ registryFile })

    expect(response.cards.map((card) => card.changeName)).toEqual(['add-thing'])
    expect(response.repositories).toContainEqual({
      id: 'p2',
      name: 'gone',
      read: 'failed',
      reason: 'unreachable',
    })
    expect(response.repositories).toContainEqual({
      id: 'p1',
      name: 'good',
      read: 'ok',
      reason: null,
    })
    expect(fleetReadState(response)).toBe('degraded')
  })

  it('renders the rest when one repository throws mid-read', async () => {
    const good = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const bad = await makeRepo(changeFiles('openspec/changes/other-thing'))
    const registryFile = await makeRegistry([
      { id: 'p1', name: 'good', root: good },
      { id: 'p2', name: 'bad', root: bad },
    ])

    const reader = await import('./changeReader.js')
    vi.spyOn(reader, 'readRepositoryChanges').mockImplementation(async (root) => {
      if (root === bad) throw new Error('the tree came apart mid-read')
      return { records: [], notices: [], paths: [] }
    })

    const response = await readChangesFleet({ registryFile })
    expect(response.repositories).toContainEqual({
      id: 'p2',
      name: 'bad',
      read: 'failed',
      reason: 'unreadable',
    })
    expect(response.repositories.find((repo) => repo.id === 'p1')!.read).toBe('ok')
  })

  it('names a repository that exceeds the bound as timed out, and answers anyway', async () => {
    const slow = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const fast = await makeRepo(changeFiles('openspec/changes/quick-thing'))
    const registryFile = await makeRegistry([
      { id: 'p1', name: 'slow', root: slow },
      { id: 'p2', name: 'fast', root: fast },
    ])

    const reader = await import('./changeReader.js')
    const real = reader.readRepositoryChanges
    vi.spyOn(reader, 'readRepositoryChanges').mockImplementation(async (root, options) => {
      // Never settles: the bound is what makes the endpoint answer at all.
      if (root === slow) return new Promise(() => {})
      return real(root, options)
    })

    const response = await readChangesFleet({ registryFile, scanTimeoutMs: 25 })

    expect(response.cards.map((card) => card.changeName)).toEqual(['quick-thing'])
    expect(response.repositories).toContainEqual({
      id: 'p1',
      name: 'slow',
      read: 'failed',
      reason: 'timeout',
    })
  })

  it('does not let a malformed entry in one repository stop another', async () => {
    const broken = await makeRepo({ 'openspec/changes/archive/nope/proposal.md': '#\n' })
    const good = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const registryFile = await makeRegistry([
      { id: 'p1', name: 'broken', root: broken },
      { id: 'p2', name: 'good', root: good },
    ])

    const response = await readChangesFleet({ registryFile })
    expect(response.cards.map((card) => card.changeName)).toEqual(['add-thing'])
    // A malformed *entry* is not a failed *repository*.
    expect(response.repositories.every((repo) => repo.read === 'ok')).toBe(true)
    expect(response.notices.some((notice) => notice.repositoryId === 'p1')).toBe(true)
  })
})

// ── 4.2 all-failed is distinguishable from no-open-changes ──────────────────

describe('all-failed versus empty', () => {
  it('reports all-failed when no repository can be read', async () => {
    const registryFile = await makeRegistry([
      { id: 'p1', name: 'a', root: join(tmpdir(), 'gone-a') },
      { id: 'p2', name: 'b', root: join(tmpdir(), 'gone-b') },
    ])

    const response = await readChangesFleet({ registryFile })
    expect(response.cards).toEqual([])
    expect(fleetReadState(response)).toBe('all-failed')
    expect(response.repositories.every((repo) => repo.read === 'failed')).toBe(true)
  })

  it('reports empty when every repository read and none had changes', async () => {
    const a = await makeRepo({ 'README.md': '#\n' })
    const b = await makeRepo({ 'openspec/specs/thing/spec.md': '#\n' })
    const registryFile = await makeRegistry([
      { id: 'p1', name: 'a', root: a },
      { id: 'p2', name: 'b', root: b },
    ])

    const response = await readChangesFleet({ registryFile })
    expect(response.cards).toEqual([])
    expect(fleetReadState(response)).toBe('empty')
    expect(response.repositories.every((repo) => repo.read === 'ok')).toBe(true)
  })

  // The two states above produce identical card arrays. If the response did not
  // carry the per-repository outcome they would be indistinguishable, which is
  // exactly what the requirement forbids.
  it('the two are distinguishable from the response alone', async () => {
    const readable = await makeRepo({ 'README.md': '#\n' })
    const empty = await readChangesFleet({
      registryFile: await makeRegistry([{ id: 'p1', name: 'a', root: readable }]),
    })
    _resetChangesCacheForTests()
    const failed = await readChangesFleet({
      registryFile: await makeRegistry([{ id: 'p1', name: 'a', root: join(tmpdir(), 'gone') }]),
    })

    expect(empty.cards).toEqual(failed.cards)
    expect(fleetReadState(empty)).not.toBe(fleetReadState(failed))
  })
})

// ── ordering ────────────────────────────────────────────────────────────────

describe('ordering', () => {
  it('orders the archive column date-descending', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/archive/2026-07-04-older'),
      ...changeFiles('openspec/changes/archive/2026-08-02-newer'),
      ...changeFiles('openspec/changes/archive/2026-07-30-middle'),
    })
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const archive = (await readChangesFleet({ registryFile })).cards.filter(
      (card) => card.stage === 'archive',
    )
    expect(archive.map((card) => card.changeName)).toEqual(['newer', 'middle', 'older'])
  })

  it('sorts a ready card ahead of every dated archive card', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/archive/2026-08-02-newer'),
      // Artifact-complete, two approvals, no rejection, checklist complete.
      'openspec/changes/done-thing/proposal.md': '#\n',
      'openspec/changes/done-thing/tasks.md': '- [x] a\n',
      'openspec/changes/done-thing/specs/thing/spec.md': '#\n',
      'openspec/changes/done-thing/REVIEWS.md':
        '## Reviewer: gemini\nVERDICT: APPROVE\n## Reviewer: codex\nVERDICT: APPROVE\n',
    })
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const archive = (await readChangesFleet({ registryFile })).cards.filter(
      (card) => card.stage === 'archive',
    )
    expect(archive.map((card) => [card.changeName, card.ready])).toEqual([
      ['done-thing', true],
      ['newer', false],
    ])
  })

  it('is stable across two reads of an unchanged fleet', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/a-thing'),
      ...changeFiles('openspec/changes/b-thing'),
      ...changeFiles('openspec/changes/archive/2026-07-04-c-thing'),
      'openspec/BACKLOG.md': '## D thing\n\n## E thing\n',
    })
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const first = await readChangesFleet({ registryFile })
    _resetChangesCacheForTests()
    const second = await readChangesFleet({ registryFile })

    expect(second.cards.map((card) => card.id)).toEqual(first.cards.map((card) => card.id))
  })

  it('breaks ties on identity, so no repository decides another’s order', async () => {
    // Two repositories, same change name, same evidence timestamps.
    const a = await makeRepo(changeFiles('openspec/changes/same-name'))
    const b = await makeRepo(changeFiles('openspec/changes/same-name'))
    const registryFile = await makeRegistry([
      { id: 'p2-second', name: 'second', root: b },
      { id: 'p1-first', name: 'first', root: a },
    ])

    // Force a genuine tie: without this the two repositories' mtimes differ by
    // a millisecond and the modification-time rule decides, never reaching the
    // tie-break this test exists to exercise.
    const { utimes } = await import('node:fs/promises')
    const stamp = new Date(1_700_000_000_000)
    for (const root of [a, b]) {
      for (const relative of ['proposal.md', 'tasks.md', 'specs/thing/spec.md']) {
        await utimes(join(root, 'openspec/changes/same-name', relative), stamp, stamp)
      }
    }

    const cards = (await readChangesFleet({ registryFile })).cards
    expect(cards).toHaveLength(2)
    expect(new Set(cards.map((card) => card.updatedAt)).size).toBe(1)
    // Ordered by identity, which begins with the registry id — a total order
    // that does not depend on registry position.
    expect(cards.map((card) => card.repositoryId)).toEqual(['p1-first', 'p2-second'])
  })
})

// ── 4.4 the cache ───────────────────────────────────────────────────────────

describe('the response cache', () => {
  it('has a named cadence matching the polling interval', () => {
    expect(CHANGES_MEMO_TTL_MS).toBe(5_000)
  })

  it('does not re-walk the repositories inside the cadence', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const reader = await import('./changeReader.js')
    const spy = vi.spyOn(reader, 'readRepositoryChanges')

    await readChangesFleet({ registryFile, now: 1_000 })
    expect(spy).toHaveBeenCalledTimes(1)

    await readChangesFleet({ registryFile, now: 1_000 + CHANGES_MEMO_TTL_MS - 1 })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('re-walks once the cadence has passed', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const reader = await import('./changeReader.js')
    const spy = vi.spyOn(reader, 'readRepositoryChanges')

    await readChangesFleet({ registryFile, now: 1_000 })
    await readChangesFleet({ registryFile, now: 1_000 + CHANGES_MEMO_TTL_MS })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('reports the time the reading was taken, not the time it was served', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    const first = await readChangesFleet({ registryFile, now: 1_000 })
    const replayed = await readChangesFleet({ registryFile, now: 4_000 })
    expect(replayed.generatedAt).toBe(first.generatedAt)
    expect(replayed.generatedAt).toBe(1_000)
  })

  it('an explicit invalidation makes the next read reflect new state', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const registryFile = await makeRegistry([{ id: 'p1', name: 'one', root }])

    expect((await readChangesFleet({ registryFile, now: 1_000 })).cards).toHaveLength(1)

    await mkdir(join(root, 'openspec/changes/second-thing/specs/thing'), { recursive: true })
    for (const [path, contents] of Object.entries(changeFiles('openspec/changes/second-thing'))) {
      await writeFile(join(root, path), contents)
    }

    // Inside the cadence, the cached reading still stands.
    expect((await readChangesFleet({ registryFile, now: 1_100 })).cards).toHaveLength(1)

    invalidateChangesCache()
    // And after invalidation, without waiting for natural expiry.
    expect((await readChangesFleet({ registryFile, now: 1_200 })).cards).toHaveLength(2)
  })

  it('a registry change is reflected without waiting for expiry', async () => {
    const a = await makeRepo(changeFiles('openspec/changes/from-a'))
    const b = await makeRepo(changeFiles('openspec/changes/from-b'))

    const one = await makeRegistry([{ id: 'p1', name: 'a', root: a }])
    const two = await makeRegistry([
      { id: 'p1', name: 'a', root: a },
      { id: 'p2', name: 'b', root: b },
    ])

    expect((await readChangesFleet({ registryFile: one, now: 1_000 })).cards).toHaveLength(1)
    // The cache is keyed on the registry, so a registry that names a second
    // repository is a different key rather than a stale hit.
    expect((await readChangesFleet({ registryFile: two, now: 1_100 })).cards).toHaveLength(2)
  })
})

// ── 4.8 no process is spawned ───────────────────────────────────────────────

describe('the board spawns nothing', () => {
  it('the board’s modules reference no process-spawning API', async () => {
    const { readFile } = await import('node:fs/promises')
    const here = dirname(new URL(import.meta.url).pathname)

    for (const file of ['service.ts', 'changeReader.ts', 'stage.ts']) {
      const source = await readFile(join(here, file), 'utf8')
      expect(source).not.toMatch(/child_process|runAllowedGit|execa|\bspawn\(/u)
    }
  })

  it('GIT_ALLOWED_CMDS is unchanged at the four subcommands', async () => {
    const { GIT_ALLOWED_CMDS } = await import('../../constants.js')
    expect([...GIT_ALLOWED_CMDS]).toEqual(['log', 'status', 'diff-stat', 'branch'])
  })
})
