import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, symlinkSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'

import { describe, it, expect, afterEach, beforeEach } from 'vitest'

import { makeTmpProject } from './__fixtures__/tmpHome.js'
import { resolveAllowed, resolveAllowedNamed, COVERAGE_ROOTS, PathViolation } from './paths.js'

describe('resolveAllowed', () => {
  let cleanup: () => void

  afterEach(() => {
    cleanup?.()
  })

  it('returns realpath inside root/.planning for valid .planning path', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    const result = await resolveAllowed(tmp.root, '.planning/PROJECT.md')
    // Use realpath for the expected value to handle macOS /var -> /private/var symlink
    const expected = await realpath(join(tmp.root, '.planning', 'PROJECT.md'))
    expect(result).toBe(expected)
  })

  it('returns realpath inside root/.claude for valid .claude path', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    const result = await resolveAllowed(tmp.root, '.claude/skills/foo/SKILL.md')
    const expected = await realpath(join(tmp.root, '.claude', 'skills', 'foo', 'SKILL.md'))
    expect(result).toBe(expected)
  })

  it('throws PathViolation with "traversal" message for ../../etc/passwd', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    await expect(resolveAllowed(tmp.root, '../../etc/passwd')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof PathViolation && /traversal/i.test((e as PathViolation).message),
    )
  })

  it('throws PathViolation with "absolute" message for absolute path', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    await expect(resolveAllowed(tmp.root, '/etc/passwd')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof PathViolation && /absolute/i.test((e as PathViolation).message),
    )
  })

  it('throws PathViolation for .planning/../../etc/passwd', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    await expect(resolveAllowed(tmp.root, '.planning/../../etc/passwd')).rejects.toBeInstanceOf(
      PathViolation,
    )
  })

  it('throws PathViolation with "outside allowed" message for planted symlink escaping root', async () => {
    const tmp = makeTmpProject({ withSymlinkEscape: true })
    cleanup = tmp.cleanup
    await expect(resolveAllowed(tmp.root, '.planning/symlink-to-outside')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof PathViolation && /outside allowed/i.test((e as PathViolation).message),
    )
  })

  it('throws PathViolation for .git/HEAD (not in .planning or .claude)', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    await expect(resolveAllowed(tmp.root, '.git/HEAD')).rejects.toBeInstanceOf(PathViolation)
  })
})

describe('resolveAllowedNamed', () => {
  let cleanups: Array<() => void> = []

  afterEach(() => {
    for (const c of cleanups) c()
    cleanups = []
  })

  it('accepts a valid absolute path inside roots[0] with allowedNames match', async () => {
    const tmp = makeTmpProject()
    cleanups.push(tmp.cleanup)
    writeFileSync(join(tmp.root, 'package.json'), '{"name":"test"}')
    const candidate = join(tmp.root, 'package.json')
    const result = await resolveAllowedNamed(candidate, {
      roots: [tmp.root],
      allowedNames: ['package.json', '.infisical.json'],
    })
    const expected = await realpath(candidate)
    expect(result).toBe(expected)
  })

  it('rejects when realpath escapes all roots (file in different tmp dir)', async () => {
    const tmp = makeTmpProject()
    cleanups.push(tmp.cleanup)
    const tmp2 = makeTmpProject()
    cleanups.push(tmp2.cleanup)
    writeFileSync(join(tmp2.root, 'package.json'), '{"name":"outside"}')
    const outsideFile = join(tmp2.root, 'package.json')
    await expect(
      resolveAllowedNamed(outsideFile, {
        roots: [tmp.root],
        allowedNames: ['package.json'],
      }),
    ).rejects.toBeInstanceOf(PathViolation)
  })

  it('rejects symlink escaping root (symlink inside root points to /etc/passwd)', async () => {
    const tmp = makeTmpProject()
    cleanups.push(tmp.cleanup)
    symlinkSync('/etc/passwd', join(tmp.root, 'evil.yml'))
    await expect(
      resolveAllowedNamed(join(tmp.root, 'evil.yml'), {
        roots: [tmp.root],
        extension: '.yml',
      }),
    ).rejects.toBeInstanceOf(PathViolation)
  })

  it('rejects basename not in allowedNames (foo.txt when allowedNames is package.json + .infisical.json)', async () => {
    const tmp = makeTmpProject()
    cleanups.push(tmp.cleanup)
    writeFileSync(join(tmp.root, 'foo.txt'), 'contents')
    await expect(
      resolveAllowedNamed(join(tmp.root, 'foo.txt'), {
        roots: [tmp.root],
        allowedNames: ['package.json', '.infisical.json'],
      }),
    ).rejects.toBeInstanceOf(PathViolation)
  })

  it('accepts package.json with allowedNames: [package.json]', async () => {
    const tmp = makeTmpProject()
    cleanups.push(tmp.cleanup)
    writeFileSync(join(tmp.root, 'package.json'), '{"name":"test"}')
    const result = await resolveAllowedNamed(join(tmp.root, 'package.json'), {
      roots: [tmp.root],
      allowedNames: ['package.json'],
    })
    expect(result).toContain('package.json')
  })

  it('accepts .yml file inside workflows dir with extension: .yml', async () => {
    const tmp = makeTmpProject()
    cleanups.push(tmp.cleanup)
    mkdirSync(join(tmp.root, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(tmp.root, '.github', 'workflows', 'ci.yml'), 'on: push')
    const workflowsRoot = join(tmp.root, '.github', 'workflows')
    const result = await resolveAllowedNamed(join(workflowsRoot, 'ci.yml'), {
      roots: [workflowsRoot],
      extension: '.yml',
    })
    expect(result).toContain('ci.yml')
  })

  it('rejects Makefile with extension: .yml (wrong extension)', async () => {
    const tmp = makeTmpProject()
    cleanups.push(tmp.cleanup)
    mkdirSync(join(tmp.root, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(tmp.root, '.github', 'workflows', 'Makefile'), 'build:')
    const workflowsRoot = join(tmp.root, '.github', 'workflows')
    await expect(
      resolveAllowedNamed(join(workflowsRoot, 'Makefile'), {
        roots: [workflowsRoot],
        extension: '.yml',
      }),
    ).rejects.toBeInstanceOf(PathViolation)
  })

  it('throws PathViolation when BOTH allowedNames and extension are provided (mutually exclusive)', async () => {
    const tmp = makeTmpProject()
    cleanups.push(tmp.cleanup)
    writeFileSync(join(tmp.root, 'package.json'), '{}')
    await expect(
      resolveAllowedNamed(join(tmp.root, 'package.json'), {
        roots: [tmp.root],
        allowedNames: ['package.json'],
        extension: '.json',
      }),
    ).rejects.toBeInstanceOf(PathViolation)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE_ROOTS + resolveAllowedNamed — Phase 10 D-10-NEW
// ─────────────────────────────────────────────────────────────────────────────

describe('COVERAGE_ROOTS', () => {
  it('COVERAGE_ROOTS.gitnexus() returns <homedir>/.gitnexus', () => {
    expect(COVERAGE_ROOTS.gitnexus()).toBe(join(homedir(), '.gitnexus'))
  })

  it('COVERAGE_ROOTS.agenticapps() returns <homedir>/Sourcecode/agenticapps', () => {
    expect(COVERAGE_ROOTS.agenticapps()).toBe(join(homedir(), 'Sourcecode', 'agenticapps'))
  })

  it('COVERAGE_ROOTS.factiv() returns <homedir>/Sourcecode/factiv', () => {
    expect(COVERAGE_ROOTS.factiv()).toBe(join(homedir(), 'Sourcecode', 'factiv'))
  })

  it('COVERAGE_ROOTS.neuroflash() returns <homedir>/Sourcecode/neuroflash', () => {
    expect(COVERAGE_ROOTS.neuroflash()).toBe(join(homedir(), 'Sourcecode', 'neuroflash'))
  })
})

describe('COVERAGE_ROOTS + resolveAllowedNamed integration', () => {
  let tmpRoot: string
  let cleanup: () => void

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'cov-roots-test-'))
    cleanup = () => rmSync(tmpRoot, { recursive: true, force: true })
    // Build fake family roots under tmpRoot
    mkdirSync(join(tmpRoot, '.gitnexus'), { recursive: true })
    mkdirSync(join(tmpRoot, 'Sourcecode', 'agenticapps'), { recursive: true })
    mkdirSync(join(tmpRoot, 'Sourcecode', 'factiv'), { recursive: true })
    mkdirSync(join(tmpRoot, 'Sourcecode', 'neuroflash'), { recursive: true })
  })

  afterEach(() => cleanup())

  // Helper: build fake COVERAGE_ROOTS bound to tmpRoot
  function fakeRoots() {
    return {
      gitnexus: () => join(tmpRoot, '.gitnexus'),
      agenticapps: () => join(tmpRoot, 'Sourcecode', 'agenticapps'),
      factiv: () => join(tmpRoot, 'Sourcecode', 'factiv'),
      neuroflash: () => join(tmpRoot, 'Sourcecode', 'neuroflash'),
    }
  }

  it('resolveAllowedNamed accepts registry.json inside fake gitnexus root', async () => {
    const roots = fakeRoots()
    const registryPath = join(roots.gitnexus(), 'registry.json')
    writeFileSync(registryPath, '[]')
    const result = await resolveAllowedNamed(registryPath, {
      roots: [roots.gitnexus()],
      allowedNames: ['registry.json'],
    })
    expect(result).toContain('registry.json')
  })

  it('resolveAllowedNamed rejects wrong filename inside gitnexus root (name not in allow-list)', async () => {
    const roots = fakeRoots()
    const badPath = join(roots.gitnexus(), 'something-else.json')
    writeFileSync(badPath, '{}')
    await expect(
      resolveAllowedNamed(badPath, {
        roots: [roots.gitnexus()],
        allowedNames: ['registry.json'],
      }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof PathViolation && /allow-list/i.test((e as PathViolation).message),
    )
  })

  it('resolveAllowedNamed accepts .wiki-compiler.json inside fake factiv root', async () => {
    const roots = fakeRoots()
    const wikiPath = join(roots.factiv(), '.wiki-compiler.json')
    writeFileSync(wikiPath, '{}')
    const result = await resolveAllowedNamed(wikiPath, {
      roots: [roots.factiv()],
      allowedNames: ['.wiki-compiler.json'],
    })
    expect(result).toContain('.wiki-compiler.json')
  })

  it('resolveAllowedNamed rejects file outside all roots (outside allowed roots)', async () => {
    const roots = fakeRoots()
    const outsideDir = mkdtempSync(join(tmpdir(), 'outside-'))
    const outsidePath = join(outsideDir, 'foo.md')
    writeFileSync(outsidePath, 'secret')
    try {
      await expect(
        resolveAllowedNamed(outsidePath, {
          roots: [roots.agenticapps()],
          extension: '.md',
        }),
      ).rejects.toSatisfy(
        (e: unknown) =>
          e instanceof PathViolation && /outside allowed roots/i.test((e as PathViolation).message),
      )
    } finally {
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('symlink escape — symlink inside factiv root pointing outside is rejected', async () => {
    const roots = fakeRoots()
    const outsideDir = mkdtempSync(join(tmpdir(), 'escape-target-'))
    const target = join(outsideDir, 'secret.txt')
    writeFileSync(target, 'sensitive')
    const symlinkPath = join(roots.factiv(), 'escape-link.json')
    symlinkSync(target, symlinkPath)
    try {
      await expect(
        resolveAllowedNamed(symlinkPath, {
          roots: [roots.factiv()],
          allowedNames: ['escape-link.json'],
        }),
      ).rejects.toBeInstanceOf(PathViolation)
    } finally {
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('path traversal — <factiv>/../neuroflash/secret.txt is rejected as outside roots', async () => {
    const roots = fakeRoots()
    const secretPath = join(roots.neuroflash(), 'secret.txt')
    writeFileSync(secretPath, 'sensitive')
    // This candidate resolves to neuroflash root — outside factiv root
    const traversalCandidate = join(roots.factiv(), '..', 'neuroflash', 'secret.txt')
    await expect(
      resolveAllowedNamed(traversalCandidate, {
        roots: [roots.factiv()],
        allowedNames: ['secret.txt'],
      }),
    ).rejects.toBeInstanceOf(PathViolation)
  })

  it('COV-02b regression — resolveAllowed with target outside .planning/.claude STILL throws (existing route not widened)', async () => {
    // Simulate a project root that happens to be inside agenticapps
    const projectRoot = join(tmpRoot, 'Sourcecode', 'agenticapps', 'my-project')
    mkdirSync(join(projectRoot, '.planning'), { recursive: true })
    mkdirSync(join(projectRoot, '.claude'), { recursive: true })
    writeFileSync(join(projectRoot, '.planning', 'STATE.md'), 'test')
    // A relative path that would traverse OUTSIDE .planning/.claude
    // The new COVERAGE_ROOTS must NOT be reachable via the existing resolveAllowed function
    await expect(
      resolveAllowed(projectRoot, '../../../.gitnexus/registry.json'),
    ).rejects.toBeInstanceOf(PathViolation)
  })

  it('resolveAllowedNamed accepts .md file inside neuroflash root using extension form', async () => {
    const roots = fakeRoots()
    const mdPath = join(roots.neuroflash(), 'README.md')
    writeFileSync(mdPath, '# readme')
    const result = await resolveAllowedNamed(mdPath, {
      roots: [roots.neuroflash()],
      extension: '.md',
    })
    expect(result).toContain('README.md')
  })

  it('resolveAllowedNamed rejects .txt file when extension: .md is required', async () => {
    const roots = fakeRoots()
    const txtPath = join(roots.agenticapps(), 'notes.txt')
    writeFileSync(txtPath, 'text')
    await expect(
      resolveAllowedNamed(txtPath, {
        roots: [roots.agenticapps()],
        extension: '.md',
      }),
    ).rejects.toBeInstanceOf(PathViolation)
  })
})
