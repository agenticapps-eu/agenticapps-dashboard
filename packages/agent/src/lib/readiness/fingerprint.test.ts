import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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
): Promise<string> {
  return fleetSignature(
    over.entries ?? [{ id: 'a', root: repo }],
    over.machineRoots ?? { codex: join(machine, 'codex', 'skills') },
  )
}

const fingerprint = async (context = signature()) =>
  repoFingerprint(repo, await context)

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

  /**
   * An unreadable readiness file raises a notice; an absent one does not. The
   * key has to tell them apart or the memo would replay the wrong one of the
   * two across the transition.
   */
  it('distinguishes an unreadable readiness file from an absent one', async () => {
    const absent = await fingerprint()
    mkdirSync(join(repo, '.agenticapps', 'readiness.json'), { recursive: true })
    expect(await fingerprint()).not.toBe(absent)
  })

  /**
   * The sibling reader resolves this path through the daemon's contained-read
   * primitive before opening it. The fingerprint must too: a readiness file
   * symlinked out of the repo would otherwise be read in full on every scan,
   * and its hash controls cache invalidation, which `generatedAt` makes
   * observable — a change oracle on a file the policy forbids opening.
   */
  it('never opens a readiness file that resolves outside the repo', async () => {
    const secret = join(sandbox, 'outside-the-repo.txt')
    writeFileSync(secret, 'first\n')
    mkdirSync(join(repo, '.agenticapps'), { recursive: true })
    symlinkSync(secret, join(repo, '.agenticapps', 'readiness.json'))

    const before = await fingerprint()
    writeFileSync(secret, 'second — the daemon must not notice this\n')

    expect(await fingerprint()).toBe(before)
  })

  it('still distinguishes an escaping symlink from an absent file', async () => {
    const absent = await fingerprint()
    const secret = join(sandbox, 'outside-the-repo.txt')
    writeFileSync(secret, 'x\n')
    mkdirSync(join(repo, '.agenticapps'), { recursive: true })
    symlinkSync(secret, join(repo, '.agenticapps', 'readiness.json'))

    expect(await fingerprint()).not.toBe(absent)
  })

  it('survives a directory that is not a git work tree', async () => {
    const bare = join(sandbox, 'not-a-repo')
    mkdirSync(bare)
    await expect(repoFingerprint(bare, await signature())).resolves.toEqual(
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
    const context = await signature()
    expect(await repoFingerprint(one, context)).not.toBe(
      await repoFingerprint(two, context),
    )
  })

  /**
   * These use non-git directories deliberately. Inside a git repo, adding a
   * readiness file also moves the status component, so the key changes whatever
   * the contained read decides — which hides what the read itself returned.
   * With no git, every other component is constant and the read is the only
   * thing under test.
   */
  describe('the contained read, isolated from git status', () => {
    function bare(name: string): string {
      const root = join(sandbox, name)
      mkdirSync(join(root, '.agenticapps'), { recursive: true })
      return root
    }

    it('distinguishes a refused symlink from an absent file', async () => {
      const absent = join(sandbox, 'no-file')
      mkdirSync(absent, { recursive: true })
      const escaping = bare('escaping')
      const secret = join(sandbox, 'secret.txt')
      writeFileSync(secret, 'x\n')
      symlinkSync(secret, join(escaping, '.agenticapps', 'readiness.json'))
      const context = await signature()

      expect(await repoFingerprint(escaping, context)).not.toBe(
        await repoFingerprint(absent, context),
      )
    })

    it('does not hash a readiness file past the read bound', async () => {
      const one = bare('big-one')
      const two = bare('big-two')
      writeFileSync(join(one, '.agenticapps', 'readiness.json'), 'a'.repeat(600 * 1024))
      writeFileSync(join(two, '.agenticapps', 'readiness.json'), 'b'.repeat(600 * 1024))
      const context = await signature()

      // Two different oversized files read alike because neither was opened.
      expect(await repoFingerprint(one, context)).toBe(
        await repoFingerprint(two, context),
      )
    })
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
  it('changes when a repo joins the registry', async () => {
    expect(await signature({ entries: [{ id: 'a', root: repo }] })).not.toBe(
      await signature({
        entries: [{ id: 'a', root: repo }, { id: 'b', root: '/b' }],
      }),
    )
  })

  it('changes when a registered root is repointed', async () => {
    expect(await signature({ entries: [{ id: 'a', root: '/one' }] })).not.toBe(
      await signature({ entries: [{ id: 'a', root: '/two' }] }),
    )
  })

  it('changes when registry order changes — the fleet is served in that order', async () => {
    const a = { id: 'a', root: '/a' }
    const b = { id: 'b', root: '/b' }
    expect(await signature({ entries: [a, b] })).not.toBe(
      await signature({ entries: [b, a] }),
    )
  })

  it('changes when a machine-global skill changes', async () => {
    const before = await signature()
    writeMachineSkill('version: 2.0.0\n')
    expect(await signature()).not.toBe(before)
  })

  it('changes when a machine-global skill disappears', async () => {
    const before = await signature()
    rmSync(join(machine, 'codex'), { recursive: true, force: true })
    expect(await signature()).not.toBe(before)
  })

  it('tolerates a machine root that does not exist', async () => {
    await expect(
      signature({ machineRoots: { codex: join(sandbox, 'nowhere') } }),
    ).resolves.toEqual(expect.any(String))
  })

  it('carries no machine path into the signature it returns', async () => {
    expect(await signature()).not.toContain(sandbox)
  })

  // The caller builds this record from `defaultMachineRoots()`, which can leave
  // a host key present with an undefined value. `Object.keys` still reports that
  // host, and joining an undefined root throws — taking down the whole fleet
  // computation over a host that simply is not installed.
  it('ignores a host whose machine skill root is undefined', async () => {
    const roots = { codex: join(machine, 'codex', 'skills') }

    await expect(
      fleetSignature([{ id: 'a', root: repo }], {
        ...roots,
        pi: undefined,
      } as unknown as Record<string, string>),
    ).resolves.toBe(await fleetSignature([{ id: 'a', root: repo }], roots))
  })

  /**
   * The machine-global skill is read through the same contained primitive as
   * the readiness file. These roots are named policy rather than request input,
   * but the file inside one can still be a symlink out of it.
   */
  it('never opens a machine skill that resolves outside its root', async () => {
    const secret = join(sandbox, 'outside-the-root.md')
    writeFileSync(secret, 'first\n')
    const linked = join(sandbox, 'linked', 'agentic-apps-workflow')
    mkdirSync(linked, { recursive: true })
    symlinkSync(secret, join(linked, 'SKILL.md'))
    const roots = { codex: join(sandbox, 'linked') }

    const before = await signature({ machineRoots: roots })
    writeFileSync(secret, 'second — the daemon must not notice this\n')

    expect(await signature({ machineRoots: roots })).toBe(before)
  })
})
