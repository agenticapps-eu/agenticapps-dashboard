import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fleetSignature, repoFingerprint } from './fingerprint.js'

let sandbox: string
let repo: string
let machine: string

function git(args: string[], date?: string): string {
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
    {
      cwd: repo,
      encoding: 'utf8',
      env: date
        ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
        : process.env,
    },
  )
}

function write(file: string, body = 'x\n'): void {
  mkdirSync(join(repo, dirname(file)), { recursive: true })
  writeFileSync(join(repo, file), body)
}

function commit(files: string[], message: string): void {
  git(['add', ...files])
  git(['commit', '-m', message], '2026-01-01T00:00:00Z')
}

/** The default fleet-wide context: one registered repo, one machine skill. */
function signature(
  over: {
    entries?: { id: string; root: string }[]
    machineRoots?: Record<string, string>
  } = {},
): string {
  return fleetSignature(
    over.entries ?? [{ id: 'a', root: repo }],
    over.machineRoots ?? { codex: join(machine, 'codex', 'skills') },
  )
}

const fingerprint = (context = signature()) => repoFingerprint(repo, context)

function writeMachineSkill(body: string): void {
  const path = join(
    machine,
    'codex',
    'skills',
    'agentic-apps-workflow',
    'SKILL.md',
  )
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'readiness-fingerprint-'))
  repo = join(sandbox, 'repo')
  machine = join(sandbox, 'machine')
  mkdirSync(repo, { recursive: true })
  git(['init', '-b', 'main'])
  write('src/index.ts')
  write('.gitignore', 'ignored/\n')
  commit(['src/index.ts', '.gitignore'], 'first')
  writeMachineSkill('version: 1.0.0\n')
})

afterEach(() => rmSync(sandbox, { recursive: true, force: true }))

describe('repoFingerprint', () => {
  it('is stable while nothing changes', async () => {
    expect(await fingerprint()).toBe(await fingerprint())
  })

  it('changes when HEAD moves', async () => {
    const before = await fingerprint()
    write('src/other.ts')
    commit(['src/other.ts'], 'second')
    expect(await fingerprint()).not.toBe(before)
  })

  it('changes when a tracked file is modified in the working tree', async () => {
    const before = await fingerprint()
    write('src/index.ts', 'changed\n')
    expect(await fingerprint()).not.toBe(before)
  })

  it('changes when an untracked file appears', async () => {
    const before = await fingerprint()
    write('src/untracked.ts')
    expect(await fingerprint()).not.toBe(before)
  })

  it('ignores a change under an ignored path', async () => {
    const before = await fingerprint()
    write('ignored/artifact.txt', 'noise\n')
    expect(await fingerprint()).toBe(before)
  })

  it('changes when the readiness file appears', async () => {
    const before = await fingerprint()
    write('.agenticapps/readiness.json', '{"schemaVersion":1,"checks":[]}')
    expect(await fingerprint()).not.toBe(before)
  })

  it('changes when the readiness file content changes', async () => {
    write('.agenticapps/readiness.json', '{"schemaVersion":1,"checks":[]}')
    commit(['.agenticapps/readiness.json'], 'declare')
    const before = await fingerprint()
    write('.agenticapps/readiness.json', '{"schemaVersion":2,"checks":[]}')
    expect(await fingerprint()).not.toBe(before)
  })

  it('survives a directory that is not a git work tree', async () => {
    const bare = join(sandbox, 'not-a-repo')
    mkdirSync(bare)
    await expect(repoFingerprint(bare, signature())).resolves.toEqual(
      expect.any(String),
    )
  })

  it('distinguishes two non-git directories by their readiness file', async () => {
    const one = join(sandbox, 'one')
    const two = join(sandbox, 'two')
    mkdirSync(join(one, '.agenticapps'), { recursive: true })
    mkdirSync(join(two, '.agenticapps'), { recursive: true })
    writeFileSync(join(one, '.agenticapps', 'readiness.json'), '{"a":1}')
    writeFileSync(join(two, '.agenticapps', 'readiness.json'), '{"a":2}')
    expect(await repoFingerprint(one, signature())).not.toBe(
      await repoFingerprint(two, signature()),
    )
  })

  it('changes when the fleet signature changes', async () => {
    const before = await fingerprint()
    expect(
      await fingerprint(
        signature({ entries: [{ id: 'a', root: repo }, { id: 'b', root: '/b' }] }),
      ),
    ).not.toBe(before)
  })
})

describe('fleetSignature', () => {
  it('changes when a repo joins the registry', () => {
    expect(signature({ entries: [{ id: 'a', root: repo }] })).not.toBe(
      signature({ entries: [{ id: 'a', root: repo }, { id: 'b', root: '/b' }] }),
    )
  })

  it('changes when a registered root is repointed', () => {
    expect(signature({ entries: [{ id: 'a', root: '/one' }] })).not.toBe(
      signature({ entries: [{ id: 'a', root: '/two' }] }),
    )
  })

  it('changes when registry order changes — the fleet is served in that order', () => {
    const a = { id: 'a', root: '/a' }
    const b = { id: 'b', root: '/b' }
    expect(signature({ entries: [a, b] })).not.toBe(signature({ entries: [b, a] }))
  })

  it('changes when a machine-global skill changes', () => {
    const before = signature()
    writeMachineSkill('version: 2.0.0\n')
    expect(signature()).not.toBe(before)
  })

  it('changes when a machine-global skill disappears', () => {
    const before = signature()
    rmSync(join(machine, 'codex'), { recursive: true, force: true })
    expect(signature()).not.toBe(before)
  })

  it('tolerates a machine root that does not exist', () => {
    expect(() =>
      signature({ machineRoots: { codex: join(sandbox, 'nowhere') } }),
    ).not.toThrow()
  })

  it('carries no machine path into the signature it returns', () => {
    expect(signature()).not.toContain(sandbox)
  })
})
