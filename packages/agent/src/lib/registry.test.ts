import { describe, it, expect, afterEach } from 'vitest'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
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
  ensureRegistryFile,
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
