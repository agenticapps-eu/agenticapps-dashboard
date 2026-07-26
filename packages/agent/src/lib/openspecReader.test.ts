/**
 * Hybrid OpenSpec reader — project-dashboard › Hybrid OpenSpec Read Strategy.
 *
 * The parity claim is pinned to five fields and scoped to conformant change
 * directories. Three values never come from the CLI at all — the archive,
 * affected capabilities, and task-artifact presence — so they are read from the
 * tree on both paths and are deliberately not parity fields.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, afterEach } from 'vitest'

import { readOpenspecTree, readOpenspecProject } from './openspecReader.js'

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'openspec-reader-'))
  cleanups.push(() => rmSync(d, { recursive: true, force: true }))
  return d
}

function makeBin(dir: string, body: string): string {
  const p = join(dir, 'openspec')
  writeFileSync(p, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
  chmodSync(p, 0o755)
  return p
}

/** A conformant project: top-level tasks.md, specs/<capability>/spec.md. */
function makeProject(): string {
  const root = tmp()
  const os = join(root, 'openspec')

  mkdirSync(join(os, 'specs', 'daemon-runtime'), { recursive: true })
  writeFileSync(
    join(os, 'specs', 'daemon-runtime', 'spec.md'),
    '### Requirement: A\ntext\n### Requirement: B\ntext\n',
  )
  mkdirSync(join(os, 'specs', 'help-docs'), { recursive: true })
  writeFileSync(join(os, 'specs', 'help-docs', 'spec.md'), '### Requirement: Only\n')

  // Open change with a task list and a spec delta touching two capabilities.
  const c1 = join(os, 'changes', 'add-thing')
  mkdirSync(join(c1, 'specs', 'daemon-runtime'), { recursive: true })
  mkdirSync(join(c1, 'specs', 'help-docs'), { recursive: true })
  writeFileSync(join(c1, 'specs', 'daemon-runtime', 'spec.md'), '### Requirement: X\n')
  writeFileSync(join(c1, 'specs', 'help-docs', 'spec.md'), '### Requirement: Y\n')
  writeFileSync(join(c1, 'tasks.md'), '- [x] one\n- [x] two\n- [ ] three\n')

  // Open change with no spec delta at all.
  const c2 = join(os, 'changes', 'no-delta-yet')
  mkdirSync(c2, { recursive: true })
  writeFileSync(join(c2, 'tasks.md'), '- [ ] a\n')

  mkdirSync(join(os, 'changes', 'archive', '2026-05-03-00-bootstrap'), { recursive: true })
  mkdirSync(join(os, 'changes', 'archive', '2026-06-11-08-panels'), { recursive: true })

  return root
}

describe('readOpenspecTree — change enumeration', () => {
  it('lists open changes, excluding archive/ and dot directories', async () => {
    const root = makeProject()
    mkdirSync(join(root, 'openspec', 'changes', '.scratch'), { recursive: true })
    const state = await readOpenspecTree(root)
    expect(state.present).toBe(true)
    expect(state.openChanges.map((c) => c.name).sort()).toEqual(['add-thing', 'no-delta-yet'])
  })

  it('counts tasks from checkbox lines, not artifact presence', async () => {
    const state = await readOpenspecTree(makeProject())
    const c = state.openChanges.find((x) => x.name === 'add-thing')!
    expect(c.completedTasks).toBe(2)
    expect(c.totalTasks).toBe(3)
    expect(c.hasTaskArtifact).toBe(true)
  })

  it('distinguishes an absent task artifact from an empty one', async () => {
    const root = makeProject()
    const os = join(root, 'openspec', 'changes')
    mkdirSync(join(os, 'no-tasks-file'), { recursive: true })
    writeFileSync(join(os, 'no-tasks-file', 'proposal.md'), '# why')
    mkdirSync(join(os, 'empty-tasks'), { recursive: true })
    writeFileSync(join(os, 'empty-tasks', 'tasks.md'), '# Tasks\n\nnothing yet\n')

    const state = await readOpenspecTree(root)
    const absent = state.openChanges.find((c) => c.name === 'no-tasks-file')!
    const empty = state.openChanges.find((c) => c.name === 'empty-tasks')!

    expect(absent.hasTaskArtifact).toBe(false)
    expect(absent.totalTasks).toBe(0)
    expect(empty.hasTaskArtifact).toBe(true)
    expect(empty.totalTasks).toBe(0)
  })

  it('lists a change holding only tasks.md, and one holding only proposal.md', async () => {
    const root = tmp()
    const changes = join(root, 'openspec', 'changes')
    mkdirSync(join(changes, 'only-tasks'), { recursive: true })
    writeFileSync(join(changes, 'only-tasks', 'tasks.md'), '- [ ] a\n')
    mkdirSync(join(changes, 'only-proposal'), { recursive: true })
    writeFileSync(join(changes, 'only-proposal', 'proposal.md'), '# why\n')

    const state = await readOpenspecTree(root)
    expect(state.openChanges.map((c) => c.name).sort()).toEqual(['only-proposal', 'only-tasks'])
  })

  it('derives affected capabilities from the change specs/ tree, empty when absent', async () => {
    const state = await readOpenspecTree(makeProject())
    const withDelta = state.openChanges.find((c) => c.name === 'add-thing')!
    const without = state.openChanges.find((c) => c.name === 'no-delta-yet')!
    expect(withDelta.affectedCapabilities.sort()).toEqual(['daemon-runtime', 'help-docs'])
    expect(without.affectedCapabilities).toEqual([])
  })
})

describe('readOpenspecTree — capabilities and archive', () => {
  it('counts requirements per capability', async () => {
    const state = await readOpenspecTree(makeProject())
    expect(state.capabilities).toEqual([
      { id: 'daemon-runtime', requirementCount: 2 },
      { id: 'help-docs', requirementCount: 1 },
    ])
  })

  it('orders archived changes by zero-padded ISO prefix', async () => {
    const state = await readOpenspecTree(makeProject())
    expect(state.archived.map((a) => a.name)).toEqual([
      '2026-06-11-08-panels',
      '2026-05-03-00-bootstrap',
    ])
  })

  it('orders a non-conforming archive directory after every conforming one', async () => {
    const root = makeProject()
    mkdirSync(join(root, 'openspec', 'changes', 'archive', 'legacy-thing'), { recursive: true })
    const state = await readOpenspecTree(root)
    expect(state.archived.map((a) => a.name)).toEqual([
      '2026-06-11-08-panels',
      '2026-05-03-00-bootstrap',
      'legacy-thing',
    ])
    expect(state.archived.at(-1)!.datePrefix).toBeNull()
  })

  it('reports absent openspec/ without throwing', async () => {
    const state = await readOpenspecTree(tmp())
    expect(state.present).toBe(false)
    expect(state.openChanges).toEqual([])
    expect(state.capabilities).toEqual([])
  })

  it('reports an openspec/ with no changes at all', async () => {
    const root = tmp()
    mkdirSync(join(root, 'openspec', 'specs'), { recursive: true })
    const state = await readOpenspecTree(root)
    expect(state.present).toBe(true)
    expect(state.openChanges).toEqual([])
    expect(state.capabilities).toEqual([])
  })

  /*
   * The fourth fixture shape: a tree that has started proposing but has not
   * declared anything yet. `present` must stay true — an empty capability list
   * is a project that promises nothing so far, which is a different state from
   * a project with no `openspec/` at all, and the two drive different empty
   * states in the Capability panel (an explicit "No capabilities declared"
   * versus rendering nothing and letting Change Progress speak).
   */
  it('reports an openspec/ carrying changes but no specs tree', async () => {
    const root = tmp()
    const change = join(root, 'openspec', 'changes', 'first-change')
    mkdirSync(change, { recursive: true })
    writeFileSync(join(change, 'tasks.md'), '- [ ] a\n- [x] b\n')

    const state = await readOpenspecTree(root)
    expect(state.present).toBe(true)
    expect(state.capabilities).toEqual([])
    expect(state.openChanges).toEqual([
      {
        name: 'first-change',
        completedTasks: 1,
        totalTasks: 2,
        hasTaskArtifact: true,
        affectedCapabilities: [],
      },
    ])
  })
})

describe('readOpenspecProject — hybrid parity', () => {
  const PARITY = (s: Awaited<ReturnType<typeof readOpenspecTree>>) => ({
    changeNames: s.openChanges.map((c) => c.name).sort(),
    counts: Object.fromEntries(
      s.openChanges.map((c) => [c.name, [c.completedTasks, c.totalTasks]]),
    ),
    capabilities: s.capabilities,
  })

  it('produces identical values on the CLI path and the tree path', async () => {
    const root = makeProject()
    const binDir = tmp()
    // A CLI that agrees with the tree, as the real one does for a conformant project.
    const bin = makeBin(
      binDir,
      `case "$*" in
  *--specs*) echo '{"specs":[{"id":"daemon-runtime","requirementCount":2},{"id":"help-docs","requirementCount":1}]}' ;;
  *) echo '{"changes":[{"name":"add-thing","completedTasks":2,"totalTasks":3},{"name":"no-delta-yet","completedTasks":0,"totalTasks":1}]}' ;;
esac`,
    )

    const viaCli = await readOpenspecProject(root, bin)
    const viaTree = await readOpenspecProject(root, null)

    expect(PARITY(viaCli)).toEqual(PARITY(viaTree))
  })

  it('keeps archive, affected capabilities and presence tree-sourced on the CLI path', async () => {
    const root = makeProject()
    const binDir = tmp()
    const bin = makeBin(
      binDir,
      `case "$*" in
  *--specs*) echo '{"specs":[]}' ;;
  *) echo '{"changes":[{"name":"add-thing","completedTasks":2,"totalTasks":3}]}' ;;
esac`,
    )
    const viaCli = await readOpenspecProject(root, bin)
    // The CLI reported no specs and only one change, but these three values are
    // never taken from it.
    expect(viaCli.archived.map((a) => a.name)).toEqual([
      '2026-06-11-08-panels',
      '2026-05-03-00-bootstrap',
    ])
    const c = viaCli.openChanges.find((x) => x.name === 'add-thing')!
    expect(c.affectedCapabilities.sort()).toEqual(['daemon-runtime', 'help-docs'])
    expect(c.hasTaskArtifact).toBe(true)
  })

  it('does not let the CLI narrow the change set', async () => {
    const root = makeProject()
    const binDir = tmp()
    // CLI omits `no-delta-yet` — a half-written change it declines to list.
    const bin = makeBin(
      binDir,
      `case "$*" in
  *--specs*) echo '{"specs":[]}' ;;
  *) echo '{"changes":[{"name":"add-thing","completedTasks":2,"totalTasks":3}]}' ;;
esac`,
    )
    const state = await readOpenspecProject(root, bin)
    expect(state.openChanges.map((c) => c.name).sort()).toEqual(['add-thing', 'no-delta-yet'])
  })

  it('prefers CLI counts for a non-conformant change the tree cannot count', async () => {
    const root = makeProject()
    const os = join(root, 'openspec', 'changes')
    // Task list stored somewhere the tree reader does not look.
    mkdirSync(join(os, 'nested-tasks', 'sub'), { recursive: true })
    writeFileSync(join(os, 'nested-tasks', 'sub', 'tasks.md'), '- [x] a\n- [ ] b\n')

    const binDir = tmp()
    const bin = makeBin(
      binDir,
      `case "$*" in
  *--specs*) echo '{"specs":[]}' ;;
  *) echo '{"changes":[{"name":"nested-tasks","completedTasks":1,"totalTasks":2}]}' ;;
esac`,
    )
    const state = await readOpenspecProject(root, bin)
    const c = state.openChanges.find((x) => x.name === 'nested-tasks')!
    expect([c.completedTasks, c.totalTasks]).toEqual([1, 2])
  })

  it('degrades to the tree when the binary is absent, with no throw', async () => {
    const root = makeProject()
    const state = await readOpenspecProject(root, null)
    expect(state.present).toBe(true)
    expect(state.openChanges).toHaveLength(2)
  })

  it('degrades to the tree when the CLI emits an unrecognised shape', async () => {
    const root = makeProject()
    const binDir = tmp()
    const bin = makeBin(binDir, `echo '{"changes":[{"name":"add-thing"}]}'`)
    const state = await readOpenspecProject(root, bin)
    const c = state.openChanges.find((x) => x.name === 'add-thing')!
    expect([c.completedTasks, c.totalTasks]).toEqual([2, 3])
  })
})
