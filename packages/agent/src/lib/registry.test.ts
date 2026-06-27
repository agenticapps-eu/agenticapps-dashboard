import {
  closeSync,
  constants as fsConstants,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { makeTmpHome, makeTmpProject } from './__fixtures__/tmpHome.js'
import {
  readRegistry,
  writeRegistry,
  addProject,
  removeProject,
  renameProject,
  setTags,
  listProjectsWithStatus,
  slugify,
  assertRegistrationAllowed,
  RegistrationPathBlocked,
} from './registry.js'

describe('slugify', () => {
  it('slugifies "Acme App!" to "acme-app"', async () => {
    expect(slugify('Acme App!')).toBe('acme-app')
  })

  it('handles unicode/diacritics deterministically', async () => {
    expect(slugify('Ré-acteur App')).toBe('re-acteur-app')
  })
})

describe('readRegistry / writeRegistry', () => {
  it('readRegistry returns { version: 1, projects: [] } when file missing (lazy init)', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const reg = readRegistry(regFile)
      expect(reg.version).toBe(1)
      expect(reg.projects).toEqual([])
    } finally {
      cleanup()
    }
  })

  it('writeRegistry round-trips through schema', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const reg = readRegistry(regFile)
      writeRegistry(reg, regFile)
      const roundtripped = readRegistry(regFile)
      expect(roundtripped).toEqual(reg)
    } finally {
      cleanup()
    }
  })

  it('writeRegistry invalidates conformance + coverage caches (every write path, not just fix-path)', async () => {
    // Regression for the cache-stale bug. CLI register/unregister/rename/tag
    // and /api/registry/register-confirm all go through writeRegistry —
    // each must invalidate the per-process caches so the next GET re-scans.
    // Previously only the fix-path route invalidated, leaving up to 30s
    // of stale data after every other registry mutation.
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const conformance = await import('./conformanceCache.js')
    const coverage = await import('./coverageCache.js')
    try {
      // Prime both caches with a sentinel value.
      conformance.setConformanceCache({
        schemaVersion: 1,
        today: {
          asOf: '2026-05-15T00:00:00.000Z',
          fleet: 50,
          agenticapps: 50,
          factiv: 50,
          neuroflash: 50,
        },
        delta14d: { fleet: 0, agenticapps: 0, factiv: 0, neuroflash: 0 },
        series: [],
        drifted: [],
      })
      coverage.setCoverageCache({
        schemaVersion: 1,
        generatedAtIso: '2026-05-15T00:00:00.000Z',
        gitNexusInstallState: 'installed-no-registry',
        workflowHeadVersion: null,
        rows: [],
      })
      expect(conformance.getConformanceCache()).not.toBeNull()
      expect(coverage.getCoverageCache()).not.toBeNull()

      // Any write through writeRegistry must invalidate.
      const reg = readRegistry(regFile)
      writeRegistry(reg, regFile)

      expect(conformance.getConformanceCache()).toBeNull()
      expect(coverage.getCoverageCache()).toBeNull()
    } finally {
      cleanup()
    }
  })
})

describe('addProject', () => {
  it('generates slug "acme-app" from basename of path', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = await addProject('/Users/x/acme-app', {}, regFile)
      expect(entry.id).toBe('acme-app')
      expect(entry.name).toBe('acme-app')
    } finally {
      cleanup()
    }
  })

  it('is idempotent on path collision — returns alreadyRegistered: true (D-10)', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const first = await addProject('/Users/x/acme-app', {}, regFile)
      const second = await addProject('/Users/x/acme-app', {}, regFile)
      expect(second.alreadyRegistered).toBe(true)
      expect(second.entry.id).toBe(first.entry.id)
      const reg = readRegistry(regFile)
      expect(reg.projects).toHaveLength(1)
    } finally {
      cleanup()
    }
  })

  it('appends -2 then -3 for slug collisions (different path, same basename)', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const r1 = await addProject('/Users/a/acme-app', {}, regFile)
      const r2 = await addProject('/Users/b/acme-app', {}, regFile)
      const r3 = await addProject('/Users/c/acme-app', {}, regFile)
      expect(r1.entry.id).toBe('acme-app')
      expect(r2.entry.id).toBe('acme-app-2')
      expect(r3.entry.id).toBe('acme-app-3')
    } finally {
      cleanup()
    }
  })

  it('persists explicit name and tags', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = await addProject('/Users/x/my-project', { name: 'My Project', tags: ['active'] }, regFile)
      expect(entry.name).toBe('My Project')
      expect(entry.tags).toEqual(['active'])
    } finally {
      cleanup()
    }
  })

  it('defaults tags to [] (D-12 no auto-tagging)', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = await addProject('/Users/x/no-tags', {}, regFile)
      expect(entry.tags).toEqual([])
    } finally {
      cleanup()
    }
  })

  it('canonicalises symlink roots via realpath at registration', async () => {
    const { configDir, cleanup: cleanupHome } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const realDir = mkdtempSync(join(tmpdir(), 'agentic-real-'))
    const linkParent = mkdtempSync(join(tmpdir(), 'agentic-link-'))
    const linkPath = join(linkParent, 'aliased')
    symlinkSync(realDir, linkPath)
    try {
      const { entry } = await addProject(linkPath, {}, regFile)
      // The registered root should be the realpath, not the symlink path.
      // realpath() may add /private prefix on macOS, so just check the link is canonicalised away
      expect(entry.root).not.toBe(linkPath)
      expect(entry.root.endsWith('/aliased')).toBe(false)

      // Re-registering via the symlink path is idempotent (D-10) — the canonical
      // root matches even though pathArg differs.
      const second = await addProject(linkPath, {}, regFile)
      expect(second.alreadyRegistered).toBe(true)
      expect(second.entry.id).toBe(entry.id)
    } finally {
      rmSync(linkPath, { force: true })
      rmSync(linkParent, { recursive: true, force: true })
      rmSync(realDir, { recursive: true, force: true })
      cleanupHome()
    }
  })

  it('falls back to resolve() when path does not exist (registration of missing path stays legal)', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const missing = join(tmpdir(), `nonexistent-${randomUUID()}`)
      const { entry } = await addProject(missing, {}, regFile)
      expect(entry.root).toBe(missing)
    } finally {
      cleanup()
    }
  })
})

describe('removeProject', () => {
  it('removes entry by id; returns true if removed', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = await addProject('/Users/x/proj', {}, regFile)
      const removed = await removeProject(entry.id, regFile)
      expect(removed).toBe(true)
      expect(readRegistry(regFile).projects).toHaveLength(0)
    } finally {
      cleanup()
    }
  })

  it('removes entry by absolute path', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      await addProject('/Users/x/proj', {}, regFile)
      const removed = await removeProject('/Users/x/proj', regFile)
      expect(removed).toBe(true)
      expect(readRegistry(regFile).projects).toHaveLength(0)
    } finally {
      cleanup()
    }
  })

  it('returns false if entry not found', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const removed = await removeProject('nonexistent-id', regFile)
      expect(removed).toBe(false)
    } finally {
      cleanup()
    }
  })
})

describe('renameProject', () => {
  it('updates name, leaves id unchanged', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = await addProject('/Users/x/proj', {}, regFile)
      await renameProject(entry.id, 'new name', regFile)
      const updated = readRegistry(regFile).projects[0]!
      expect(updated.name).toBe('new name')
      expect(updated.id).toBe(entry.id)
    } finally {
      cleanup()
    }
  })
})

describe('setTags', () => {
  it('replaces tags array entirely', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = await addProject('/Users/x/proj', { tags: ['old'] }, regFile)
      await setTags(entry.id, ['client', 'active'], regFile)
      const updated = readRegistry(regFile).projects[0]!
      expect(updated.tags).toEqual(['client', 'active'])
    } finally {
      cleanup()
    }
  })
})

describe('listProjectsWithStatus', () => {
  it('marks reachable: false when project root no longer exists', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const fakeRoot = `/nonexistent/path/${randomUUID()}`
    try {
      await addProject(fakeRoot, {}, regFile)
      const list = await listProjectsWithStatus(regFile)
      expect(list[0]!.status.reachable).toBe(false)
    } finally {
      cleanup()
    }
  })

  it('marks reachable: true when project root exists', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const proj = makeTmpProject()
    try {
      await addProject(proj.root, {}, regFile)
      const list = await listProjectsWithStatus(regFile)
      expect(list[0]!.status.reachable).toBe(true)
    } finally {
      proj.cleanup()
      cleanup()
    }
  })

  it('does NOT crash on unreachable roots', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const fakeRoot = `/nonexistent/path/${randomUUID()}`
    try {
      await addProject(fakeRoot, {}, regFile)
      await expect(listProjectsWithStatus(regFile)).resolves.toHaveLength(1)
    } finally {
      cleanup()
    }
  })

  it('returns lastCommitAt as UTC `Z` form so RegistryListItemSchema validation passes', async () => {
    // Regression: git's %cI emits ISO-8601 with timezone offset (e.g. 2026-05-04T11:44:11+02:00),
    // but z.string().datetime() rejects offsets unless { offset: true }. detectLastCommitAt
    // must normalise to UTC Z so the daemon's boot-time validation doesn't crash.
    const { execa } = await import('execa')
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const proj = makeTmpProject()
    try {
      // Initialise a real git repo with one commit so detectLastCommitAt has output
      await execa('git', ['init', '-q', '-b', 'main'], { cwd: proj.root })
      await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: proj.root })
      await execa('git', ['config', 'user.name', 'Test'], { cwd: proj.root })
      await execa('git', ['add', '.'], { cwd: proj.root })
      await execa('git', ['commit', '-q', '-m', 'initial'], { cwd: proj.root })
      await addProject(proj.root, {}, regFile)
      const list = await listProjectsWithStatus(regFile)
      expect(list[0]!.status.lastCommitAt).toMatch(/Z$/)
      expect(list[0]!.status.lastCommitAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    } finally {
      proj.cleanup()
      cleanup()
    }
  })
})

describe('assertRegistrationAllowed (B2 confused-deputy stopgap)', () => {
  it('throws RegistrationPathBlocked for system roots', async () => {
    expect(() => assertRegistrationAllowed('/etc')).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed('/usr/bin')).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed('/System')).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed('/')).toThrow(RegistrationPathBlocked)
  })

  it('throws for paths under system roots (e.g. /etc/foo)', async () => {
    expect(() => assertRegistrationAllowed('/etc/foo')).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed('/usr/bin/foo')).toThrow(RegistrationPathBlocked)
  })

  it('throws for $HOME credential dirs', async () => {
    expect(() => assertRegistrationAllowed(join(homedir(), '.ssh'))).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed(join(homedir(), '.aws'))).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed(join(homedir(), '.gnupg', 'pubring.gpg'))).toThrow(RegistrationPathBlocked)
  })

  it('throws for the daemon state dir itself', async () => {
    expect(() => assertRegistrationAllowed(join(homedir(), '.agenticapps', 'dashboard'))).toThrow(
      RegistrationPathBlocked,
    )
    expect(() =>
      assertRegistrationAllowed(join(homedir(), '.agenticapps', 'dashboard', 'subdir')),
    ).toThrow(RegistrationPathBlocked)
  })

  it('allows normal project paths under $HOME (e.g. ~/Sourcecode/myproject)', async () => {
    expect(() =>
      assertRegistrationAllowed(join(homedir(), 'Sourcecode', 'myproject')),
    ).not.toThrow()
  })

  it('allows /tmp and /var/folders (test fixtures depend on these)', async () => {
    expect(() => assertRegistrationAllowed('/tmp/myproject')).not.toThrow()
    expect(() => assertRegistrationAllowed('/var/folders/abc/T/agentic-test-')).not.toThrow()
    expect(() => assertRegistrationAllowed('/private/var/folders/abc/T/x')).not.toThrow()
  })

  it('addProject() rethrows the error so HTTP / CLI layers can format it', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      await expect(addProject('/etc', {}, regFile)).rejects.toThrow(RegistrationPathBlocked)
      // Registry stays empty
      expect(readRegistry(regFile).projects).toHaveLength(0)
    } finally {
      cleanup()
    }
  })
})

// ── Codex WARNING #2 hardening (D-13-EXT-09 corollary) ───────────────────────
//
// A registered path of the shape ~/Sourcecode/{known-family}/{repo}/{subdir}
// silently hijacks scans for {family}/{repo} into the subdir, because
// derivedRepoId() only reads the first two path segments past ~/Sourcecode/.
// assertRegistrationAllowed now rejects such paths at registration time.
describe('assertRegistrationAllowed — D-13-EXT-09 subdir hijack defence (Codex WARNING #2)', () => {
  let stashedHome: string | undefined
  let fakeHome: string

  beforeEach(() => {
    stashedHome = process.env.HOME
    fakeHome = mkdtempSync(join(tmpdir(), 'dash-home-subdir-'))
    process.env.HOME = fakeHome
    mkdirSync(join(fakeHome, 'Sourcecode', 'agenticapps', 'repo', 'subdir'), { recursive: true })
    mkdirSync(join(fakeHome, 'Sourcecode', 'factiv', 'cparx', 'apps', 'web'), { recursive: true })
  })

  afterEach(() => {
    if (stashedHome !== undefined) process.env.HOME = stashedHome
    else delete process.env.HOME
    try { rmSync(fakeHome, { recursive: true, force: true }) } catch { /* best-effort */ }
  })

  it('throws when path is a subdirectory of ~/Sourcecode/{known-family}/{repo}', () => {
    const subdir = join(fakeHome, 'Sourcecode', 'agenticapps', 'repo', 'subdir')
    expect(() => assertRegistrationAllowed(subdir)).toThrow(/sourcecode-family-subdir/)
  })

  it('throws for deeply nested subdirs as well', () => {
    const deep = join(fakeHome, 'Sourcecode', 'factiv', 'cparx', 'apps', 'web')
    expect(() => assertRegistrationAllowed(deep)).toThrow(/sourcecode-family-subdir/)
  })

  it('allows ~/Sourcecode/{family}/{repo} itself (canonical project root)', () => {
    const repoRoot = join(fakeHome, 'Sourcecode', 'agenticapps', 'repo')
    expect(() => assertRegistrationAllowed(repoRoot)).not.toThrow()
  })

  it('allows ~/Sourcecode/{family} (family root — no repo specified)', () => {
    // Not a typical registration target, but the rule should not over-block.
    const familyRoot = join(fakeHome, 'Sourcecode', 'agenticapps')
    expect(() => assertRegistrationAllowed(familyRoot)).not.toThrow()
  })

  it('allows ~/Sourcecode/{non-family-name}/{any-depth} (rule scoped to known families)', () => {
    const nonFamilyDeep = join(fakeHome, 'Sourcecode', 'misc', 'a', 'b', 'c')
    mkdirSync(nonFamilyDeep, { recursive: true })
    expect(() => assertRegistrationAllowed(nonFamilyDeep)).not.toThrow()
  })

  it('allows paths outside ~/Sourcecode/ entirely', () => {
    const outside = join(fakeHome, 'Projects', 'misc')
    mkdirSync(outside, { recursive: true })
    expect(() => assertRegistrationAllowed(outside)).not.toThrow()
  })
})

describe('registry mutation lock', () => {
  // Regression for Codex F4 followup (TODOS.md) + the symmetric daemon-route
  // gap noted in writeRegistry's comment.
  //
  // Each of the four mutation functions must wrap its read-modify-write in
  // withRegistryLock so a concurrent CLI invocation cannot clobber a daemon
  // write last-writer-wins (and vice versa). To prove this without spinning up
  // two processes, we manually pre-acquire `<registry>.lock` with O_EXCL —
  // which is exactly what withRegistryLock itself does — then call the
  // mutation with a tight maxWaitMs and assert it surfaces a timeout error.
  //
  // If the function had bypassed the lock, the pre-existing lock file would
  // be irrelevant and the call would succeed; the test would fail. That's
  // the bypass-detector.
  function holdLock(regFile: string): { release: () => void } {
    const lockFile = `${regFile}.lock`
    const fd = openSync(
      lockFile,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
      0o600,
    )
    return {
      release: () => {
        try { closeSync(fd) } catch { /* already closed */ }
        try { unlinkSync(lockFile) } catch { /* already gone */ }
      },
    }
  }

  it('addProject waits for the registry lock and surfaces registry_lock_timeout', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const held = holdLock(regFile)
    try {
      await expect(
        addProject('/Users/x/proj', {}, regFile, { maxWaitMs: 100 }),
      ).rejects.toThrow(/registry_lock_timeout/)
      // Pre-existing lock blocked the write, so the registry is untouched.
      expect(readRegistry(regFile).projects).toHaveLength(0)
    } finally {
      held.release()
      cleanup()
    }
  })

  it('removeProject waits for the registry lock and surfaces registry_lock_timeout', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    // Seed a project to remove, BEFORE acquiring the lock.
    const { entry } = await addProject('/Users/x/proj', {}, regFile)
    const held = holdLock(regFile)
    try {
      await expect(
        removeProject(entry.id, regFile, { maxWaitMs: 100 }),
      ).rejects.toThrow(/registry_lock_timeout/)
      expect(readRegistry(regFile).projects).toHaveLength(1)
    } finally {
      held.release()
      cleanup()
    }
  })

  it('renameProject waits for the registry lock and surfaces registry_lock_timeout', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const { entry } = await addProject('/Users/x/proj', {}, regFile)
    const held = holdLock(regFile)
    try {
      await expect(
        renameProject(entry.id, 'should-not-stick', regFile, { maxWaitMs: 100 }),
      ).rejects.toThrow(/registry_lock_timeout/)
      // Name unchanged because the write was blocked.
      expect(readRegistry(regFile).projects[0]!.name).toBe(entry.name)
    } finally {
      held.release()
      cleanup()
    }
  })

  it('setTags waits for the registry lock and surfaces registry_lock_timeout', async () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const { entry } = await addProject('/Users/x/proj', { tags: ['old'] }, regFile)
    const held = holdLock(regFile)
    try {
      await expect(
        setTags(entry.id, ['new'], regFile, { maxWaitMs: 100 }),
      ).rejects.toThrow(/registry_lock_timeout/)
      // Tags unchanged because the write was blocked.
      expect(readRegistry(regFile).projects[0]!.tags).toEqual(['old'])
    } finally {
      held.release()
      cleanup()
    }
  })
})
