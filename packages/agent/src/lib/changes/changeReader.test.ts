/**
 * changeReader.test.ts — the corpus reader, over real temp directories.
 *
 * Every case that matters here came from a plan-review finding against a
 * hand-written substitute for a rule upstream already had. The backlog cases in
 * particular run against this repository's own `BACKLOG.md`, because the
 * substring matcher that closed `Redone migration` passed every invented
 * fixture it was given.
 */
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { isReadableProjectPath } from '@agenticapps/dashboard-shared'

import {
  ContainmentAnchorEscaped,
  MAX_CHANGE_FILE_BYTES,
  MAX_SOURCE_RECORDS,
  archivedSlug,
  backlogSlug,
  parseBacklog,
  readRepositoryChanges,
} from './changeReader.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__')

const temps: string[] = []
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

/** A repository laid out from a path → contents map. Directories are implied. */
async function makeRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'change-board-'))
  temps.push(root)
  for (const [path, contents] of Object.entries(files)) {
    const absolute = join(root, path)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, contents)
  }
  return root
}

/** The three artifacts that make a directory a change, at their simplest. */
const changeFiles = (dir: string) => ({
  [`${dir}/proposal.md`]: '# why\n',
  [`${dir}/tasks.md`]: '- [ ] a\n- [x] b\n',
  [`${dir}/specs/thing/spec.md`]: '## ADDED Requirements\n',
})

const find = (records: Awaited<ReturnType<typeof readRepositoryChanges>>['records'], name: string) =>
  records.find((record) => record.changeName === name)

// ── 3.1 the corpus ───────────────────────────────────────────────────────────

describe('readRepositoryChanges', () => {
  it('reads active changes, dated archives and unresolved backlog entries', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      ...changeFiles('openspec/changes/archive/2026-07-04-old-thing'),
      'openspec/BACKLOG.md': '## Something unstarted\n\nA body line.\n',
    })
    const { records } = await readRepositoryChanges(root)

    expect(records.map((r) => [r.source, r.changeName]).sort()).toEqual([
      ['active', 'add-thing'],
      ['archive', 'old-thing'],
      ['backlog', 'something-unstarted'],
    ])
  })

  it('reports artifact presence, checklist rows and reviewer verdicts', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/changes/add-thing/design.md': '# how\n',
      'openspec/changes/add-thing/REVIEWS.md': [
        '## Reviewer: gemini',
        'VERDICT: APPROVE',
        '## Reviewer: codex',
        'VERDICT: REQUEST-CHANGES',
      ].join('\n'),
    })
    const record = find((await readRepositoryChanges(root)).records, 'add-thing')!

    expect(record.artifacts).toEqual({
      proposal: 'ready',
      deltaSpecCount: 1,
      tasks: 'ready',
      design: 'ready',
    })
    expect(record.checklist).toEqual([
      { text: 'a', completed: false },
      { text: 'b', completed: true },
    ])
    expect(record.reviewerVendors).toEqual(['gemini'])
    expect(record.hasRequestChanges).toBe(true)
    expect(record.reviewRecord).toBe('REVIEWS.md')
  })

  it('counts one delta spec per `specs/<name>/spec.md` that reads', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/changes/add-thing/specs/other/spec.md': '## ADDED Requirements\n',
      // A specs subdirectory with no spec.md is not a delta spec.
      'openspec/changes/add-thing/specs/empty/notes.md': 'x\n',
    })
    expect(find((await readRepositoryChanges(root)).records, 'add-thing')!.artifacts.deltaSpecCount)
      .toBe(2)
  })

  it('reports a missing proposal and a missing tasks file rather than throwing', async () => {
    const root = await makeRepo({
      'openspec/changes/add-thing/design.md': '# how\n',
    })
    const record = find((await readRepositoryChanges(root)).records, 'add-thing')!
    expect(record.artifacts).toEqual({
      proposal: 'missing',
      deltaSpecCount: 0,
      tasks: 'missing',
      design: 'ready',
    })
    expect(record.checklist).toEqual([])
  })

  it('carries the archive entry’s date and full dated basename', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/archive/2026-07-04-old-thing'))
    const record = find((await readRepositoryChanges(root)).records, 'old-thing')!
    expect(record.archiveDate).toBe('2026-07-04')
    expect(record.sourceInstance).toBe('2026-07-04-old-thing')
    expect(record.changeName).toBe('old-thing')
  })

  it('gives a non-archive record a null archive date', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/BACKLOG.md': '## Unstarted\n',
    })
    const { records } = await readRepositoryChanges(root)
    expect(records).toHaveLength(2)
    for (const record of records) {
      expect(record.archiveDate).toBeNull()
    }
  })

  it('dates each record by its newest evidence', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const record = find((await readRepositoryChanges(root)).records, 'add-thing')!
    expect(record.updatedAt).toBeGreaterThan(0)
  })
})

// ── 3.2 no openspec/ at all ─────────────────────────────────────────────────

describe('a repository without OpenSpec', () => {
  it('yields no cards and is not reported as an error', async () => {
    const root = await makeRepo({ 'README.md': '# a repo\n' })
    expect(await readRepositoryChanges(root)).toMatchObject({ records: [], notices: [] })
    // The same reader, on a repository that does have one, is not empty — so
    // "no cards" is a fact about this repository, not about the reader.
    const withSpec = await makeRepo(changeFiles('openspec/changes/add-thing'))
    expect((await readRepositoryChanges(withSpec)).records).toHaveLength(1)
  })

  it('yields no cards when openspec/ exists but holds no changes and no backlog', async () => {
    const root = await makeRepo({
      'openspec/specs/thing/spec.md': '# durable\n',
      ...changeFiles('openspec/changes/add-thing'),
    })
    // The durable spec tree contributes nothing; the change beside it does.
    expect((await readRepositoryChanges(root)).records.map((r) => r.changeName)).toEqual([
      'add-thing',
    ])

    const bare = await makeRepo({ 'openspec/specs/thing/spec.md': '# durable\n' })
    expect(await readRepositoryChanges(bare)).toMatchObject({ records: [], notices: [] })
  })

  it('is silent when openspec/changes is absent but BACKLOG.md is present', async () => {
    const root = await makeRepo({ 'openspec/BACKLOG.md': '## Unstarted\n' })
    const { records, notices } = await readRepositoryChanges(root)
    expect(records.map((r) => r.changeName)).toEqual(['unstarted'])
    expect(notices).toEqual([])
  })
})

// ── 3.3 malformed input is skipped and counted, never fatal ─────────────────

describe('malformed input', () => {
  it('skips an archive entry whose name is not `YYYY-MM-DD-<slug>` and reports it', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/archive/2026-07-04-old-thing'),
      ...changeFiles('openspec/changes/archive/not-a-dated-entry'),
    })
    const { records, notices } = await readRepositoryChanges(root)

    expect(records.map((r) => r.changeName)).toEqual(['old-thing'])
    expect(notices).toContainEqual({
      source: 'archive',
      kind: 'malformed',
      changeName: 'not-a-dated-entry',
    })
  })

  it('does not let one malformed entry take the rest of the repository', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      ...changeFiles('openspec/changes/archive/nope'),
      'openspec/BACKLOG.md': '## Unstarted\n',
    })
    const { records } = await readRepositoryChanges(root)
    expect(records.map((r) => r.changeName).sort()).toEqual(['add-thing', 'unstarted'])
  })

  it('reports an archive entry that is dated but holds no artifacts', async () => {
    // 10.9: the artifact test applies to archive entries too, and a failing one
    // is reported rather than silently dropped.
    const root = await makeRepo({
      'openspec/changes/archive/2026-07-04-hollow/notes.txt': 'x\n',
      ...changeFiles('openspec/changes/archive/2026-07-05-real'),
    })
    const { records, notices } = await readRepositoryChanges(root)

    expect(records.map((r) => r.changeName)).toEqual(['real'])
    expect(notices).toContainEqual({
      source: 'archive',
      kind: 'malformed',
      changeName: 'hollow',
    })
  })
})

// ── 3.4 archive/ is not a change, and neither is a non-change directory ─────

describe('what is not a change', () => {
  it('does not treat `archive/` itself as an active change', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      ...changeFiles('openspec/changes/archive/2026-07-04-old-thing'),
    })
    const { records } = await readRepositoryChanges(root)

    expect(records.map((r) => r.changeName)).not.toContain('archive')
    expect(records.filter((r) => r.source === 'active').map((r) => r.changeName)).toEqual([
      'add-thing',
    ])
  })

  it('produces no card for a file sitting in changes/, or for an artifact-less directory', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/changes/README.md': '# how changes work\n',
      'openspec/changes/scratch/notes.txt': 'nothing here\n',
    })
    const { records, notices } = await readRepositoryChanges(root)

    expect(records.map((r) => r.changeName)).toEqual(['add-thing'])
    // Silent: an artifact-less directory is an absence, not a defect.
    expect(notices).toEqual([])
  })

  it('reads this repository’s own changes/ tree without inventing entries', async () => {
    // The real tree is the fixture: it holds `archive/` alongside active
    // changes, and no stray directories. A reader that counts `archive/` fails
    // here. Deliberately no assertion on any *named* change — an earlier
    // version required `add-agent-change-board`, which `/opsx:archive` moves
    // under `changes/archive/`, so the test was written to go red on main the
    // moment the change it shipped with was filed.
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..')
    const { records } = await readRepositoryChanges(repoRoot)
    const active = records.filter((r) => r.source === 'active').map((r) => r.changeName)

    expect(active.length).toBeGreaterThan(0)
    expect(active).not.toContain('archive')
    expect(records.filter((r) => r.source === 'archive').length).toBeGreaterThan(0)
    for (const record of records.filter((r) => r.source === 'archive')) {
      expect(record.sourceInstance).toMatch(/^\d{4}-\d{2}-\d{2}-/)
    }
  })
})

// ── 3.5 the backlog, against this repository's own file ─────────────────────

describe('parseBacklog', () => {
  it('closes this repository’s two closed entries and leaves the third open', async () => {
    const markdown = await readFile(join(fixtures, 'real/BACKLOG.md'), 'utf8')
    const { records } = parseBacklog(markdown)
    const titles = records.map((record) => record.title)

    expect(titles).not.toContain('Human verification backlog')
    expect(titles.some((title) => title.includes('Known stale artifact'))).toBe(false)
    expect(records).toHaveLength(1)
  })

  it('does not close a heading that merely contains a marker word', async () => {
    // 11.1: the substring rule closed both of these. Upstream's matchers are
    // anchored, so neither is touched.
    const { records } = parseBacklog(
      ['## Redone migration', '', 'body', '', '## Add WITHDRAWN flag support', '', 'body'].join('\n'),
    )
    expect(records.map((r) => r.title)).toEqual(['Redone migration', 'Add WITHDRAWN flag support'])
  })

  it.each([
    ['## [RESOLVED] a thing', 'a bracketed prefix'],
    ['## RESOLVED: a thing', 'a colon prefix'],
    ['## [RETIRED] a thing', 'RETIRED'],
    ['## [DONE] a thing', 'DONE'],
    ['## [CLOSED] a thing', 'CLOSED'],
    ['## [resolved] a thing', 'a lowercase marker'],
  ])('closes %s — %s', (heading) => {
    expect(parseBacklog(`${heading}\n\nbody\n`).records).toEqual([])
    // The same document with the marker removed stays open, so a parser that
    // returns nothing cannot satisfy this.
    const open = heading.replace(/^## (\[[A-Za-z]+\]|[A-Za-z]+:) /u, '## ')
    expect(parseBacklog(`${open}\n\nbody\n`).records).toHaveLength(1)
  })

  it('closes an entry whose first body line is a status marker', () => {
    expect(parseBacklog('## A thing\n\n**Status:** RETIRED\n').records).toEqual([])
    expect(parseBacklog('## A thing\n\nStatus: DONE\n').records).toEqual([])
    // Same heading, ordinary first body line: open.
    expect(parseBacklog('## A thing\n\nsome prose\n').records).toHaveLength(1)
  })

  it('reads only the first non-empty body line as the status marker', () => {
    // A marker further down the section does not close the entry.
    expect(parseBacklog('## A thing\n\nsome prose\n\n**Status:** RETIRED\n').records)
      .toHaveLength(1)
  })

  it('ignores a `## ` line inside a fenced code block', () => {
    const { records } = parseBacklog(
      ['## A real entry', '', '```md', '## Not an entry', '```', ''].join('\n'),
    )
    expect(records.map((r) => r.title)).toEqual(['A real entry'])
  })

  it('ignores a `## ` line inside a tilde-fenced block', () => {
    const { records } = parseBacklog(
      ['## A real entry', '', '~~~', '## Not an entry', '~~~', ''].join('\n'),
    )
    expect(records.map((r) => r.title)).toEqual(['A real entry'])
  })

  it('reports a duplicate slug as a collision rather than a second record', () => {
    const { records, notices } = parseBacklog('## A thing\n\nx\n\n## A  thing\n\ny\n')
    expect(records).toHaveLength(1)
    expect(notices).toContainEqual({ source: 'backlog', kind: 'collision', changeName: 'a-thing' })
  })

  it('reports a heading that slugs to nothing', () => {
    const { records, notices } = parseBacklog('## ...\n\nx\n')
    expect(records).toEqual([])
    expect(notices).toContainEqual({ source: 'backlog', kind: 'empty-slug' })
  })

  it('strips closing-hash heading decoration', () => {
    expect(parseBacklog('## A thing ##\n').records.map((r) => r.title)).toEqual(['A thing'])
  })
})

describe('backlogSlug', () => {
  it('lowercases, strips accents and hyphenates non-alphanumerics', () => {
    expect(backlogSlug('Añadir Cosas — Now!')).toBe('anadir-cosas-now')
  })

  it('is stable under reordering, because it derives from the title', () => {
    expect(backlogSlug('A thing')).toBe(backlogSlug('A thing'))
  })

  it('returns empty for a title with no alphanumerics', () => {
    expect(backlogSlug('—')).toBe('')
  })
})

describe('archivedSlug', () => {
  it('accepts the exact dated shape and returns the slug', () => {
    expect(archivedSlug('2026-07-04-add-thing')).toBe('add-thing')
  })

  it.each(['add-thing', '2026-7-4-add-thing', '2026-07-04-', '2026-07-04--x', 'x-2026-07-04-y'])(
    'rejects %s',
    (name) => {
      expect(archivedSlug(name)).toBeUndefined()
    },
  )
})

// ── 3.6 absent is silent, present-but-unreadable is reported ────────────────

describe('the absent / malformed split', () => {
  it('is silent for an absent BACKLOG.md', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const { records, notices } = await readRepositoryChanges(root)
    expect(notices).toEqual([])
    // Silence is about the missing backlog, not about reading nothing.
    expect(records.map((r) => r.changeName)).toEqual(['add-thing'])
  })

  it('is silent for an empty BACKLOG.md', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/BACKLOG.md': '',
    })
    const { records, notices } = await readRepositoryChanges(root)
    expect(records.filter((r) => r.source === 'backlog')).toEqual([])
    expect(records.map((r) => r.changeName)).toEqual(['add-thing'])
    expect(notices).toEqual([])
  })

  it('is silent for a directory holding none of the three artifacts', async () => {
    const root = await makeRepo({
      'openspec/changes/scratch/notes.txt': 'x\n',
      ...changeFiles('openspec/changes/add-thing'),
    })
    const { records, notices } = await readRepositoryChanges(root)
    // The scratch directory is silent; the real change beside it is admitted.
    expect(records.map((r) => r.changeName)).toEqual(['add-thing'])
    expect(notices).toEqual([])
  })

  it('reports an oversized artifact rather than reading it', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/changes/add-thing/tasks.md': 'x'.repeat(MAX_CHANGE_FILE_BYTES + 1),
    })
    const { records, notices } = await readRepositoryChanges(root)

    // The file is skipped, not the change: upstream's semantics, and a card
    // that vanishes because one file is large reports nothing at all.
    const record = find(records, 'add-thing')!
    expect(record.artifacts.tasks).toBe('missing')
    expect(record.checklist).toEqual([])
    expect(record.evidenceLimited).toBe(true)
    expect(notices).toContainEqual({
      source: 'evidence',
      kind: 'evidence-limited',
      changeName: 'add-thing',
    })
  })

  it('reports an oversized BACKLOG.md rather than reading it', async () => {
    const root = await makeRepo({
      'openspec/BACKLOG.md': `## A thing\n${'x'.repeat(MAX_CHANGE_FILE_BYTES)}`,
    })
    const { records, notices } = await readRepositoryChanges(root)
    expect(records).toEqual([])
    expect(notices).toContainEqual({ source: 'backlog', kind: 'rejected', admitted: 0 })
  })

  it('reports an artifact that is not a regular file', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    await rm(join(root, 'openspec/changes/add-thing/tasks.md'))
    await mkdir(join(root, 'openspec/changes/add-thing/tasks.md'))

    const { records, notices } = await readRepositoryChanges(root)
    expect(find(records, 'add-thing')!.artifacts.tasks).toBe('missing')
    expect(notices).toContainEqual({
      source: 'active',
      kind: 'malformed',
      changeName: 'add-thing',
    })
  })

  it('no input is both silent and reported', async () => {
    // The two readings are exclusive by construction: a silent case emits no
    // notice, a reported case emits one and the pair never overlaps.
    const silent = await makeRepo({ 'openspec/changes/scratch/notes.txt': 'x\n' })
    const reported = await makeRepo({ 'openspec/changes/archive/nope/proposal.md': '#\n' })

    const silentResult = await readRepositoryChanges(silent)
    const reportedResult = await readRepositoryChanges(reported)

    expect(silentResult.notices).toHaveLength(0)
    expect(silentResult.records).toHaveLength(0)
    expect(reportedResult.notices.length).toBeGreaterThan(0)
    expect(reportedResult.records).toHaveLength(0)
  })
})

// ── 3.7 identity and deduplication ──────────────────────────────────────────

describe('identity', () => {
  it('makes two dated archives of one slug two records', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/archive/2026-07-04-add-thing'),
      ...changeFiles('openspec/changes/archive/2026-08-02-add-thing'),
    })
    const { records } = await readRepositoryChanges(root)

    expect(records).toHaveLength(2)
    expect(records.map((r) => r.sourceInstance).sort()).toEqual([
      '2026-07-04-add-thing',
      '2026-08-02-add-thing',
    ])
    // Same slug, distinct instances — which is what keeps their addresses apart.
    expect(new Set(records.map((r) => r.changeName)).size).toBe(1)
  })

  it('admits a backlog entry whose slug is already an active change only once', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/BACKLOG.md': '## Add thing\n\nbody\n',
    })
    const { records } = await readRepositoryChanges(root)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ source: 'active', changeName: 'add-thing' })
  })

  it('admits a backlog entry whose slug is already an archived change only once', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/archive/2026-07-04-add-thing'),
      'openspec/BACKLOG.md': '## Add thing\n\nbody\n',
    })
    const { records } = await readRepositoryChanges(root)
    expect(records.map((r) => r.source)).toEqual(['archive'])
  })

  it('still admits a backlog entry whose slug matches nothing', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/BACKLOG.md': '## Some other work\n\nbody\n',
    })
    const { records } = await readRepositoryChanges(root)
    expect(records.map((r) => r.changeName).sort()).toEqual(['add-thing', 'some-other-work'])
  })

  it('uses the slug as a backlog entry’s instance, never its raw heading', async () => {
    const root = await makeRepo({
      'openspec/BACKLOG.md': '## A Thing: with a colon & an ampersand\n\nbody\n',
    })
    const record = (await readRepositoryChanges(root)).records[0]!

    expect(record.sourceInstance).toBe('a-thing-with-a-colon-an-ampersand')
    expect(record.sourceInstance).not.toContain(':')
    expect(record.sourceInstance).not.toContain('&')
    // The raw heading survives for display, but it is not the identity.
    expect(record.title).toBe('A Thing: with a colon & an ampersand')
  })

  it('uses the directory name as an active change’s instance', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    expect((await readRepositoryChanges(root)).records[0]!.sourceInstance).toBe('add-thing')
  })

  // Deduplication is "a backlog entry whose slug is already an active or
  // archived *change*". A directory that is not a change is not a change, so it
  // cannot occupy the slug — otherwise a scratch directory silently deletes a
  // real backlog card and nothing reports it.
  it('does not let a non-change directory occupy a backlog entry’s slug', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/real-change'),
      'openspec/changes/scratch-notes/notes.txt': 'just my notes\n',
      'openspec/BACKLOG.md': '## Scratch Notes\n\nA real backlog item.\n',
    })

    const { records } = await readRepositoryChanges(root)
    // The scratch directory contributes no card of its own …
    expect(records.filter((r) => r.source === 'active').map((r) => r.changeName))
      .toEqual(['real-change'])
    // … so it must not have removed the backlog entry either.
    expect(records.filter((r) => r.source === 'backlog').map((r) => r.changeName))
      .toEqual(['scratch-notes'])
  })
})

// ── 3.8 the per-source bound ────────────────────────────────────────────────

describe('the per-source bound', () => {
  it('admits at most MAX_SOURCE_RECORDS and reports what it withheld', async () => {
    const files: Record<string, string> = {}
    const observed = MAX_SOURCE_RECORDS + 3
    for (let index = 0; index < observed; index += 1) {
      Object.assign(files, changeFiles(`openspec/changes/change-${String(index).padStart(4, '0')}`))
    }
    const root = await makeRepo(files)
    const { records, notices } = await readRepositoryChanges(root)

    expect(records).toHaveLength(MAX_SOURCE_RECORDS)
    expect(notices).toContainEqual({
      source: 'active',
      kind: 'truncated',
      admitted: MAX_SOURCE_RECORDS,
      observed,
    })
  })

  it('bounds each source independently', async () => {
    const files: Record<string, string> = {}
    for (let index = 0; index < MAX_SOURCE_RECORDS + 1; index += 1) {
      const stamp = String(index).padStart(4, '0')
      Object.assign(files, changeFiles(`openspec/changes/archive/2026-07-04-a${stamp}`))
    }
    Object.assign(files, changeFiles('openspec/changes/add-thing'))
    const root = await makeRepo(files)
    const { records, notices } = await readRepositoryChanges(root)

    // The active source is nowhere near its bound and is not truncated with it.
    expect(records.filter((r) => r.source === 'active')).toHaveLength(1)
    expect(records.filter((r) => r.source === 'archive')).toHaveLength(MAX_SOURCE_RECORDS)
    expect(notices.filter((n) => n.kind === 'truncated').map((n) => n.source)).toEqual(['archive'])
  })

  it('emits no truncation notice at exactly the bound', async () => {
    const files: Record<string, string> = {}
    for (let index = 0; index < MAX_SOURCE_RECORDS; index += 1) {
      Object.assign(files, changeFiles(`openspec/changes/c${String(index).padStart(4, '0')}`))
    }
    const root = await makeRepo(files)
    const { records, notices } = await readRepositoryChanges(root)
    expect(records).toHaveLength(MAX_SOURCE_RECORDS)
    expect(notices).toEqual([])
  })
})

// ── 3.10 the lexical guard ──────────────────────────────────────────────────

describe('the read allow-list', () => {
  it('every path the reader touches passes isReadableProjectPath', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      ...changeFiles('openspec/changes/archive/2026-07-04-old-thing'),
      'openspec/BACKLOG.md': '## Unstarted\n',
    })
    const { paths } = await readRepositoryChanges(root, { recordPaths: true })

    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) {
      expect(isReadableProjectPath(path)).toBe(true)
    }
  })

  it('the archive and backlog paths specifically pass it', () => {
    expect(isReadableProjectPath('openspec/changes/archive/2026-07-04-x/proposal.md')).toBe(true)
    expect(isReadableProjectPath('openspec/BACKLOG.md')).toBe(true)
    // And the guard is not vacuous — it does reject things.
    expect(isReadableProjectPath('../.env')).toBe(false)
    expect(isReadableProjectPath('openspec')).toBe(false)
  })
})

// ── 3.11 realpath containment, scoped to <root>/openspec ────────────────────

describe('containment', () => {
  it('does not read through a symlinked artifact escaping the openspec tree', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      '.env': 'SECRET=hunter2\n',
    })
    await rm(join(root, 'openspec/changes/add-thing/proposal.md'))
    await symlink(join(root, '.env'), join(root, 'openspec/changes/add-thing/proposal.md'))

    const { records, notices } = await readRepositoryChanges(root)

    expect(records).toEqual([])
    expect(notices).toContainEqual({
      source: 'active',
      kind: 'rejected',
      changeName: 'add-thing',
    })
  })

  // The case that made round 3 reject a root-scoped check: `.git/config` is
  // inside the same repository, so a containment check scoped to the project
  // root passes it. The board is entitled to a repository's OpenSpec tree, not
  // to its repository.
  it('rejects a symlink to a file elsewhere inside the same repository', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      '.git/config': '[core]\n',
    })
    await rm(join(root, 'openspec/changes/add-thing/tasks.md'))
    await symlink(join(root, '.git/config'), join(root, 'openspec/changes/add-thing/tasks.md'))

    const { records, notices } = await readRepositoryChanges(root)
    expect(records).toEqual([])
    expect(notices).toContainEqual({
      source: 'active',
      kind: 'rejected',
      changeName: 'add-thing',
    })

    // The control: the identical tree without the symlink is read normally, so
    // the refusal is caused by the escape and not by the fixture.
    const control = await makeRepo(changeFiles('openspec/changes/add-thing'))
    expect((await readRepositoryChanges(control)).records).toHaveLength(1)
  })

  it('rejects a symlinked change directory escaping the openspec tree', async () => {
    const root = await makeRepo({
      'elsewhere/proposal.md': '# why\n',
      'elsewhere/tasks.md': '- [ ] a\n',
      'elsewhere/specs/thing/spec.md': '#\n',
      'openspec/.keep': '',
    })
    await mkdir(join(root, 'openspec/changes'), { recursive: true })
    await symlink(join(root, 'elsewhere'), join(root, 'openspec/changes/sneaky'))

    const { records, notices } = await readRepositoryChanges(root)
    expect(records).toEqual([])
    expect(notices.some((notice) => notice.kind === 'rejected')).toBe(true)
  })

  // Round-4 review (codex) pointed out that re-resolving the path for the stat
  // and again for the read leaves a window where the two see different files.
  // The fix opens once with `O_NOFOLLOW` and stats that descriptor — which also
  // makes the rule simply "no symlinked artifacts", wherever they point, rather
  // than a rule about where a symlink is allowed to resolve to. That is
  // upstream's rule too: `readEvidenceText` has always opened `O_NOFOLLOW`.
  it('refuses a symlinked artifact even when it resolves inside the openspec tree', async () => {
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/shared/proposal.md': '# a shared proposal\n',
    })
    await rm(join(root, 'openspec/changes/add-thing/proposal.md'))
    await symlink(
      join(root, 'openspec/shared/proposal.md'),
      join(root, 'openspec/changes/add-thing/proposal.md'),
    )

    const { records, notices } = await readRepositoryChanges(root)
    expect(records).toEqual([])
    expect(notices).toContainEqual({
      source: 'active',
      kind: 'rejected',
      changeName: 'add-thing',
    })

    // The control: a real file at the same path is read, so the refusal is
    // caused by the symlink and not by the fixture.
    const control = await makeRepo(changeFiles('openspec/changes/add-thing'))
    expect((await readRepositoryChanges(control)).records[0]!.artifacts.proposal).toBe('ready')
  })

  it('checks the size against the descriptor it will read, not against the path', async () => {
    // The observable half of the descriptor fix: an oversized file is still
    // caught, and the cap is applied to the same open file the read would use.
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/changes/add-thing/tasks.md': 'x'.repeat(MAX_CHANGE_FILE_BYTES + 1),
    })
    const record = find((await readRepositoryChanges(root)).records, 'add-thing')!
    expect(record.artifacts.tasks).toBe('missing')
    expect(record.evidenceLimited).toBe(true)
  })

  it('rejects a symlinked BACKLOG.md escaping the openspec tree', async () => {
    const root = await makeRepo({ '.env': 'SECRET=x\n', 'openspec/.keep': '' })
    await symlink(join(root, '.env'), join(root, 'openspec/BACKLOG.md'))

    const { records, notices } = await readRepositoryChanges(root)
    expect(records).toEqual([])
    expect(notices).toContainEqual({ source: 'backlog', kind: 'rejected', admitted: 0 })
  })

  // The cases above are all symlinks *under* `openspec/`, checked against the
  // anchor. These two are about the anchor itself: `openspec` *being* a symlink
  // redefines the boundary every other check is made against, so each per-path
  // check passes while the whole tree is outside the repository.
  // `filesystem-access-policy` › `A Containment Anchor Is Verified Against Its
  // Registered Root`.
  it('reads nothing when openspec/ is a symlink escaping the repository', async () => {
    const outside = await makeRepo({
      'changes/leaked-change/proposal.md': '# why\n',
      'changes/leaked-change/tasks.md': '- [ ] SECRET-TASK-TEXT\n',
      'changes/leaked-change/specs/thing/spec.md': '## ADDED Requirements\n',
      'BACKLOG.md': '## Leaked backlog entry\n\nbody\n',
    })
    const root = await mkdtemp(join(tmpdir(), 'change-board-'))
    temps.push(root)
    await symlink(outside, join(root, 'openspec'), 'dir')

    // Refused, not merely empty: an escaped anchor that returned no records and
    // no report would be byte-identical to a repository with no `openspec/` at
    // all, and the requirement asks for the failure to be reported.
    await expect(readRepositoryChanges(root)).rejects.toBeInstanceOf(ContainmentAnchorEscaped)
  })

  it('still reads an openspec/ symlinked within the same repository', async () => {
    // The control: the anchor moved, but not out of the root, so the repository
    // is still describing its own corpus and the rule must not refuse it.
    const root = await makeRepo({
      ...changeFiles('real/openspec/changes/add-thing'),
    })
    await symlink(join(root, 'real/openspec'), join(root, 'openspec'), 'dir')

    const { records } = await readRepositoryChanges(root)
    expect(find(records, 'add-thing')).toBeDefined()
  })
})

// ── 3.12 the size cap is a named constant, checked before the read ──────────

describe('the read cap', () => {
  it('is a named constant', () => {
    expect(typeof MAX_CHANGE_FILE_BYTES).toBe('number')
    expect(MAX_CHANGE_FILE_BYTES).toBe(1024 * 1024)
  })

  it('is checked before the read, not after', async () => {
    // A 4 MiB tasks.md must never be materialised. The observable proof is that
    // the read is refused and reported; the constant above is what bounds it.
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/changes/add-thing/tasks.md': 'x'.repeat(4 * 1024 * 1024),
    })
    const { records } = await readRepositoryChanges(root)
    expect(find(records, 'add-thing')!.artifacts.tasks).toBe('missing')
  })

  it('admits a file exactly at the cap', async () => {
    const body = '- [x] a\n'
    const root = await makeRepo({
      ...changeFiles('openspec/changes/add-thing'),
      'openspec/changes/add-thing/tasks.md': body + 'x'.repeat(MAX_CHANGE_FILE_BYTES - body.length),
    })
    const record = find((await readRepositoryChanges(root)).records, 'add-thing')!
    expect(record.artifacts.tasks).toBe('ready')
    expect(record.checklist).toEqual([{ text: 'a', completed: true }])
  })
})

// ── review record selection, over real files ────────────────────────────────

describe('review record selection on disk', () => {
  it('classifies from the most recently modified record and names it', async () => {
    const dir = 'openspec/changes/add-thing'
    const root = await makeRepo({
      ...changeFiles(dir),
      [`${dir}/REVIEWS.md`]: '## Reviewer: gemini\nVERDICT: APPROVE\n',
      [`${dir}/REVIEWS-round-1.md`]: '## Reviewer: codex\nVERDICT: REQUEST-CHANGES\n',
    })
    // Make the round record unambiguously newer.
    const { utimes } = await import('node:fs/promises')
    await utimes(join(root, dir, 'REVIEWS.md'), new Date(1_000), new Date(1_000))
    await utimes(join(root, dir, 'REVIEWS-round-1.md'), new Date(9_000_000), new Date(9_000_000))

    const record = find((await readRepositoryChanges(root)).records, 'add-thing')!
    expect(record.reviewRecord).toBe('REVIEWS-round-1.md')
    expect(record.reviewerVendors).toEqual([])
    expect(record.hasRequestChanges).toBe(true)
  })

  it('leaves the review record null when a change carries none', async () => {
    const root = await makeRepo(changeFiles('openspec/changes/add-thing'))
    const record = find((await readRepositoryChanges(root)).records, 'add-thing')!
    expect(record.reviewRecord).toBeNull()
    expect(record.reviewerVendors).toEqual([])
    expect(record.hasRequestChanges).toBe(false)
  })
})
