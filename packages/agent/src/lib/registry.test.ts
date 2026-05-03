import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { describe, it, expect } from 'vitest'

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
  it('slugifies "Acme App!" to "acme-app"', () => {
    expect(slugify('Acme App!')).toBe('acme-app')
  })

  it('handles unicode/diacritics deterministically', () => {
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

  it('writeRegistry round-trips through schema', () => {
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
})

describe('addProject', () => {
  it('generates slug "acme-app" from basename of path', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = addProject('/Users/x/acme-app', {}, regFile)
      expect(entry.id).toBe('acme-app')
      expect(entry.name).toBe('acme-app')
    } finally {
      cleanup()
    }
  })

  it('is idempotent on path collision — returns alreadyRegistered: true (D-10)', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const first = addProject('/Users/x/acme-app', {}, regFile)
      const second = addProject('/Users/x/acme-app', {}, regFile)
      expect(second.alreadyRegistered).toBe(true)
      expect(second.entry.id).toBe(first.entry.id)
      const reg = readRegistry(regFile)
      expect(reg.projects).toHaveLength(1)
    } finally {
      cleanup()
    }
  })

  it('appends -2 then -3 for slug collisions (different path, same basename)', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const r1 = addProject('/Users/a/acme-app', {}, regFile)
      const r2 = addProject('/Users/b/acme-app', {}, regFile)
      const r3 = addProject('/Users/c/acme-app', {}, regFile)
      expect(r1.entry.id).toBe('acme-app')
      expect(r2.entry.id).toBe('acme-app-2')
      expect(r3.entry.id).toBe('acme-app-3')
    } finally {
      cleanup()
    }
  })

  it('persists explicit name and tags', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = addProject('/Users/x/my-project', { name: 'My Project', tags: ['active'] }, regFile)
      expect(entry.name).toBe('My Project')
      expect(entry.tags).toEqual(['active'])
    } finally {
      cleanup()
    }
  })

  it('defaults tags to [] (D-12 no auto-tagging)', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = addProject('/Users/x/no-tags', {}, regFile)
      expect(entry.tags).toEqual([])
    } finally {
      cleanup()
    }
  })

  it('canonicalises symlink roots via realpath at registration', () => {
    const { configDir, cleanup: cleanupHome } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    const realDir = mkdtempSync(join(tmpdir(), 'agentic-real-'))
    const linkParent = mkdtempSync(join(tmpdir(), 'agentic-link-'))
    const linkPath = join(linkParent, 'aliased')
    symlinkSync(realDir, linkPath)
    try {
      const { entry } = addProject(linkPath, {}, regFile)
      // The registered root should be the realpath, not the symlink path.
      // realpath() may add /private prefix on macOS, so just check the link is canonicalised away
      expect(entry.root).not.toBe(linkPath)
      expect(entry.root.endsWith('/aliased')).toBe(false)

      // Re-registering via the symlink path is idempotent (D-10) — the canonical
      // root matches even though pathArg differs.
      const second = addProject(linkPath, {}, regFile)
      expect(second.alreadyRegistered).toBe(true)
      expect(second.entry.id).toBe(entry.id)
    } finally {
      rmSync(linkPath, { force: true })
      rmSync(linkParent, { recursive: true, force: true })
      rmSync(realDir, { recursive: true, force: true })
      cleanupHome()
    }
  })

  it('falls back to resolve() when path does not exist (registration of missing path stays legal)', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const missing = join(tmpdir(), `nonexistent-${randomUUID()}`)
      const { entry } = addProject(missing, {}, regFile)
      expect(entry.root).toBe(missing)
    } finally {
      cleanup()
    }
  })
})

describe('removeProject', () => {
  it('removes entry by id; returns true if removed', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = addProject('/Users/x/proj', {}, regFile)
      const removed = removeProject(entry.id, regFile)
      expect(removed).toBe(true)
      expect(readRegistry(regFile).projects).toHaveLength(0)
    } finally {
      cleanup()
    }
  })

  it('removes entry by absolute path', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      addProject('/Users/x/proj', {}, regFile)
      const removed = removeProject('/Users/x/proj', regFile)
      expect(removed).toBe(true)
      expect(readRegistry(regFile).projects).toHaveLength(0)
    } finally {
      cleanup()
    }
  })

  it('returns false if entry not found', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const removed = removeProject('nonexistent-id', regFile)
      expect(removed).toBe(false)
    } finally {
      cleanup()
    }
  })
})

describe('renameProject', () => {
  it('updates name, leaves id unchanged', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = addProject('/Users/x/proj', {}, regFile)
      renameProject(entry.id, 'new name', regFile)
      const updated = readRegistry(regFile).projects[0]!
      expect(updated.name).toBe('new name')
      expect(updated.id).toBe(entry.id)
    } finally {
      cleanup()
    }
  })
})

describe('setTags', () => {
  it('replaces tags array entirely', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      const { entry } = addProject('/Users/x/proj', { tags: ['old'] }, regFile)
      setTags(entry.id, ['client', 'active'], regFile)
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
      addProject(fakeRoot, {}, regFile)
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
      addProject(proj.root, {}, regFile)
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
      addProject(fakeRoot, {}, regFile)
      await expect(listProjectsWithStatus(regFile)).resolves.toHaveLength(1)
    } finally {
      cleanup()
    }
  })
})

describe('assertRegistrationAllowed (B2 confused-deputy stopgap)', () => {
  it('throws RegistrationPathBlocked for system roots', () => {
    expect(() => assertRegistrationAllowed('/etc')).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed('/usr/bin')).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed('/System')).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed('/')).toThrow(RegistrationPathBlocked)
  })

  it('throws for paths under system roots (e.g. /etc/foo)', () => {
    expect(() => assertRegistrationAllowed('/etc/foo')).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed('/usr/bin/foo')).toThrow(RegistrationPathBlocked)
  })

  it('throws for $HOME credential dirs', () => {
    expect(() => assertRegistrationAllowed(join(homedir(), '.ssh'))).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed(join(homedir(), '.aws'))).toThrow(RegistrationPathBlocked)
    expect(() => assertRegistrationAllowed(join(homedir(), '.gnupg', 'pubring.gpg'))).toThrow(RegistrationPathBlocked)
  })

  it('throws for the daemon state dir itself', () => {
    expect(() => assertRegistrationAllowed(join(homedir(), '.agenticapps', 'dashboard'))).toThrow(
      RegistrationPathBlocked,
    )
    expect(() =>
      assertRegistrationAllowed(join(homedir(), '.agenticapps', 'dashboard', 'subdir')),
    ).toThrow(RegistrationPathBlocked)
  })

  it('allows normal project paths under $HOME (e.g. ~/Sourcecode/myproject)', () => {
    expect(() =>
      assertRegistrationAllowed(join(homedir(), 'Sourcecode', 'myproject')),
    ).not.toThrow()
  })

  it('allows /tmp and /var/folders (test fixtures depend on these)', () => {
    expect(() => assertRegistrationAllowed('/tmp/myproject')).not.toThrow()
    expect(() => assertRegistrationAllowed('/var/folders/abc/T/agentic-test-')).not.toThrow()
    expect(() => assertRegistrationAllowed('/private/var/folders/abc/T/x')).not.toThrow()
  })

  it('addProject() rethrows the error so HTTP / CLI layers can format it', () => {
    const { configDir, cleanup } = makeTmpHome()
    const regFile = join(configDir, 'registry.json')
    try {
      expect(() => addProject('/etc', {}, regFile)).toThrow(RegistrationPathBlocked)
      // Registry stays empty
      expect(readRegistry(regFile).projects).toHaveLength(0)
    } finally {
      cleanup()
    }
  })
})
