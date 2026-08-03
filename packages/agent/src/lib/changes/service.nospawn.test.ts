/**
 * service.nospawn.test.ts — the board creates no process, asserted at runtime.
 *
 * Its own file because `vi.mock` is hoisted and applies file-wide: every entry
 * point of `node:child_process` is replaced with a thrower, so any spawn
 * anywhere under a fleet read fails loudly rather than being counted. The
 * ESM namespace cannot be spied on in place, which is why this is a module
 * mock and not a `vi.spyOn` in `service.test.ts`.
 *
 * This is the runtime half of task 4.8. The static half — that the board's
 * three modules mention no process-spawning API at all, and that
 * `GIT_ALLOWED_CMDS` is unchanged — lives in `service.test.ts`.
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => {
  const refuse = (name: string) => () => {
    throw new Error(`the change board must not call child_process.${name}`)
  }
  return {
    spawn: refuse('spawn'),
    spawnSync: refuse('spawnSync'),
    exec: refuse('exec'),
    execSync: refuse('execSync'),
    execFile: refuse('execFile'),
    execFileSync: refuse('execFileSync'),
    fork: refuse('fork'),
    default: {},
  }
})

const { _resetChangesCacheForTests, readChangesFleet } = await import('./service.js')

const temps: string[] = []
afterEach(async () => {
  _resetChangesCacheForTests()
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function write(files: Record<string, string>, root: string) {
  for (const [path, contents] of Object.entries(files)) {
    const absolute = join(root, path)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, contents)
  }
}

describe('the board spawns no process', () => {
  it('assembles a fleet with every child_process entry point booby-trapped', async () => {
    const root = await mkdtemp(join(tmpdir(), 'change-nospawn-'))
    temps.push(root)
    await write(
      {
        'openspec/changes/add-thing/proposal.md': '# why\n',
        'openspec/changes/add-thing/tasks.md': '- [ ] a\n',
        'openspec/changes/add-thing/specs/thing/spec.md': '#\n',
        'openspec/changes/archive/2026-07-04-old-thing/proposal.md': '# why\n',
        'openspec/changes/archive/2026-07-04-old-thing/tasks.md': '- [x] a\n',
        'openspec/changes/add-thing/REVIEWS.md': '## Reviewer: gemini\nVERDICT: APPROVE\n',
        'openspec/BACKLOG.md': '## Unstarted\n\nbody\n',
      },
      root,
    )

    const registryDir = await mkdtemp(join(tmpdir(), 'change-nospawn-registry-'))
    temps.push(registryDir)
    const registryFile = join(registryDir, 'registry.json')
    await writeFile(
      registryFile,
      JSON.stringify({
        version: 1,
        projects: [
          {
            id: 'p1',
            name: 'one',
            root,
            client: null,
            addedAt: '2026-08-03T00:00:00.000Z',
            tags: [],
          },
        ],
      }),
    )

    // Every source contributes, so the walk covers active, archive and backlog.
    const response = await readChangesFleet({ registryFile })
    expect(new Set(response.cards.map((card) => card.source))).toEqual(
      new Set(['active', 'archive', 'backlog']),
    )
    expect(response.repositories.every((repo) => repo.read === 'ok')).toBe(true)
  })
})
