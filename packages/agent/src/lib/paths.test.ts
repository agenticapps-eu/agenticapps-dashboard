import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, symlinkSync, mkdtempSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'

import { describe, it, expect, afterEach, beforeEach } from 'vitest'

import { makeTmpProject } from './__fixtures__/tmpHome.js'
import {
  resolveAllowed,
  resolveAllowedNamed,
  isAnchoredUnder,
  COVERAGE_ROOTS,
  PathViolation,
} from './paths.js'

describe('isAnchoredUnder', () => {
  it('accepts a boundary equal to the root', () => {
    expect(isAnchoredUnder('/a/root', '/a/root')).toBe(true)
  })

  it('accepts a boundary under the root', () => {
    expect(isAnchoredUnder('/a/root/.claude/skills', '/a/root')).toBe(true)
  })

  // The reason this is a separate predicate rather than a bare startsWith:
  // a sibling whose name merely begins with the root's name is NOT under it.
  it('rejects a sibling whose name shares the root as a prefix', () => {
    expect(isAnchoredUnder('/a/rootster/secrets', '/a/root')).toBe(false)
  })

  it('rejects a boundary outside the root', () => {
    expect(isAnchoredUnder('/tmp/outside', '/a/root')).toBe(false)
  })

  it('rejects a parent of the root', () => {
    expect(isAnchoredUnder('/a', '/a/root')).toBe(false)
  })
})

/**
 * A project whose `.claude` entry is itself a symlink to a directory outside
 * the project root — the containment-anchor escape. The target deliberately
 * carries both an arbitrary file and a plausibly-named `skills/foo/SKILL.md`,
 * so a reader that adopts the escaped boundary would serve either one.
 */
function makeTmpAnchorEscape(): { root: string; outside: string; cleanup: () => void } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-anchor-')))
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-anchor-outside-')))
  mkdirSync(join(root, '.planning'), { recursive: true })
  mkdirSync(join(outside, 'skills', 'foo'), { recursive: true })
  writeFileSync(join(outside, 'secrets.txt'), 'THIS IS OUTSIDE THE PROJECT ROOT')
  writeFileSync(join(outside, 'skills', 'foo', 'SKILL.md'), 'outside skill')
  symlinkSync(outside, join(root, '.claude'), 'dir')
  return {
    root,
    outside,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    },
  }
}

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

  // add-openspec-project-reader task group 1 — openspec/ joins the allow-list.
  it('returns realpath inside root/openspec for valid openspec path', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    mkdirSync(join(tmp.root, 'openspec', 'specs', 'daemon-runtime'), { recursive: true })
    writeFileSync(join(tmp.root, 'openspec', 'specs', 'daemon-runtime', 'spec.md'), '# spec')
    const result = await resolveAllowed(tmp.root, 'openspec/specs/daemon-runtime/spec.md')
    const expected = await realpath(
      join(tmp.root, 'openspec', 'specs', 'daemon-runtime', 'spec.md'),
    )
    expect(result).toBe(expected)
  })

  it('rejects traversal that escapes out of openspec/', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    mkdirSync(join(tmp.root, 'openspec'), { recursive: true })
    await expect(resolveAllowed(tmp.root, 'openspec/../../etc/passwd')).rejects.toBeInstanceOf(
      PathViolation,
    )
  })

  it('rejects a symlink under openspec/ whose realpath escapes the project', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    mkdirSync(join(tmp.root, 'openspec'), { recursive: true })
    const outside = mkdtempSync(join(tmpdir(), 'agentic-outside-'))
    writeFileSync(join(outside, 'secret.txt'), 'secret')
    symlinkSync(join(outside, 'secret.txt'), join(tmp.root, 'openspec', 'escape.md'))
    await expect(resolveAllowed(tmp.root, 'openspec/escape.md')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof PathViolation && /outside allowed/i.test((e as PathViolation).message),
    )
    rmSync(outside, { recursive: true, force: true })
  })

  // anchor-allowed-subdirs-to-root task group 1 — the allow-listed directory
  // being ITSELF a symlink. Distinct from the cases above, which all plant a
  // symlink *under* a real allow-listed directory: here the boundary the reader
  // adopts is the thing that escaped, so every per-path check still passes.
  it('refuses a read whose allow-listed directory is itself an escaping symlink', async () => {
    const tmp = makeTmpAnchorEscape()
    cleanup = tmp.cleanup
    await expect(resolveAllowed(tmp.root, '.claude/secrets.txt')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof PathViolation && /outside allowed/i.test((e as PathViolation).message),
    )
  })

  it('does not leak the escaped target even when the basename looks allow-listed', async () => {
    const tmp = makeTmpAnchorEscape()
    cleanup = tmp.cleanup
    await expect(
      resolveAllowed(tmp.root, '.claude/skills/foo/SKILL.md'),
    ).rejects.toBeInstanceOf(PathViolation)
  })

  // Control: the two shapes that MUST keep working. If either of these ever
  // goes red, the anchor check has over-tightened.
  it('control — an ordinary allow-listed directory still resolves', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    const result = await resolveAllowed(tmp.root, '.claude/skills/foo/SKILL.md')
    expect(result).toBe(await realpath(join(tmp.root, '.claude', 'skills', 'foo', 'SKILL.md')))
  })

  it('control — a symlink under an allow-listed directory pointing within the project still resolves', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    const target = join(tmp.root, '.claude', 'skills', 'foo', 'SKILL.md')
    symlinkSync(target, join(tmp.root, '.planning', 'linked-skill.md'))
    const result = await resolveAllowed(tmp.root, '.planning/linked-skill.md')
    expect(result).toBe(await realpath(target))
  })

  // Explicitly rejected in the change's non-goals: relocated GSD history under
  // docs/ stays unreadable, because allow-listing docs/ would expose unrelated content.
  it('still rejects docs/legacy-planning — deliberately NOT allow-listed', async () => {
    const tmp = makeTmpProject()
    cleanup = tmp.cleanup
    mkdirSync(join(tmp.root, 'docs', 'legacy-planning'), { recursive: true })
    writeFileSync(join(tmp.root, 'docs', 'legacy-planning', 'STATE.md'), 'history')
    await expect(
      resolveAllowed(tmp.root, 'docs/legacy-planning/STATE.md'),
    ).rejects.toBeInstanceOf(PathViolation)
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
      containment: { kind: 'repository-root' },
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
        containment: { kind: 'repository-root' },
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
        containment: { kind: 'repository-root' },
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
        containment: { kind: 'repository-root' },
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
      containment: { kind: 'repository-root' },
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
      containment: { kind: 'repository-root' },
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
        containment: { kind: 'repository-root' },
        extension: '.yml',
      }),
    ).rejects.toBeInstanceOf(PathViolation)
  })

  // anchor-allowed-subdirs-to-root task 2.4 — anchorTo.
  describe('anchorTo', () => {
    it('drops a derived root that has left the repository, refusing its target', async () => {
      const tmp = makeTmpAnchorEscape()
      cleanups.push(tmp.cleanup)
      const skillRoot = join(tmp.root, '.claude', 'skills')
      await expect(
        resolveAllowedNamed(join(skillRoot, 'foo', 'SKILL.md'), {
          roots: [skillRoot],
          allowedNames: ['SKILL.md'],
          containment: { kind: 'anchored', root: tmp.root },
        }),
      ).rejects.toBeInstanceOf(PathViolation)
    })

    it('keeps a derived root that is still inside the repository', async () => {
      const tmp = makeTmpProject()
      cleanups.push(tmp.cleanup)
      const skillRoot = join(tmp.root, '.claude', 'skills')
      const result = await resolveAllowedNamed(join(skillRoot, 'foo', 'SKILL.md'), {
        roots: [skillRoot],
        allowedNames: ['SKILL.md'],
        containment: { kind: 'anchored', root: tmp.root },
      })
      expect(result).toBe(await realpath(join(skillRoot, 'foo', 'SKILL.md')))
    })

    // The proposal's second finding: roots are alternatives, so listing the repo
    // root alongside an escaped derived root must not rescue the escaped one.
    it('pairing an escaped root with the repository root does not admit the escaped target', async () => {
      const tmp = makeTmpAnchorEscape()
      cleanups.push(tmp.cleanup)
      const skillRoot = join(tmp.root, '.claude', 'skills')
      await expect(
        resolveAllowedNamed(join(skillRoot, 'foo', 'SKILL.md'), {
          roots: [skillRoot, tmp.root],
          allowedNames: ['SKILL.md'],
          containment: { kind: 'anchored', root: tmp.root },
        }),
      ).rejects.toBeInstanceOf(PathViolation)
    })

    it('raises PathViolation when no root survives the anchor filter', async () => {
      const tmp = makeTmpAnchorEscape()
      cleanups.push(tmp.cleanup)
      await expect(
        resolveAllowedNamed(join(tmp.outside, 'secrets.txt'), {
          roots: [join(tmp.root, '.claude')],
          allowedNames: ['secrets.txt'],
          containment: { kind: 'anchored', root: tmp.root },
        }),
      ).rejects.toSatisfy(
        (e: unknown) =>
          e instanceof PathViolation && /anchored/i.test((e as PathViolation).message),
      )
    })

    // codex, round 2: an anchored call must not compare against a lexically
    // normalised root either. isAnchoredUnder's precondition is that both sides
    // are canonical realpaths, so a root that cannot be resolved is dropped
    // rather than fudged.
    it('drops a derived root that cannot be resolved instead of using its lexical form', async () => {
      const tmp = makeTmpProject()
      cleanups.push(tmp.cleanup)
      await expect(
        resolveAllowedNamed(join(tmp.root, '.claude', 'skills', 'foo', 'SKILL.md'), {
          roots: [join(tmp.root, 'no-such-directory')],
          allowedNames: ['SKILL.md'],
          containment: { kind: 'anchored', root: tmp.root },
        }),
      ).rejects.toBeInstanceOf(PathViolation)
    })

    it('without anchorTo, behaviour is unchanged — the derived root is still honoured', async () => {
      const tmp = makeTmpAnchorEscape()
      cleanups.push(tmp.cleanup)
      const skillRoot = join(tmp.root, '.claude', 'skills')
      const result = await resolveAllowedNamed(join(skillRoot, 'foo', 'SKILL.md'), {
        roots: [skillRoot],
        containment: { kind: 'repository-root' },
        allowedNames: ['SKILL.md'],
      })
      expect(result).toBe(await realpath(join(tmp.outside, 'skills', 'foo', 'SKILL.md')))
    })
  })

  it('throws PathViolation when BOTH allowedNames and extension are provided (mutually exclusive)', async () => {
    const tmp = makeTmpProject()
    cleanups.push(tmp.cleanup)
    writeFileSync(join(tmp.root, 'package.json'), '{}')
    await expect(
      resolveAllowedNamed(join(tmp.root, 'package.json'), {
        roots: [tmp.root],
        containment: { kind: 'repository-root' },
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
    mkdirSync(join(tmpRoot, 'Sourcecode', 'agenticapps'), { recursive: true })
    mkdirSync(join(tmpRoot, 'Sourcecode', 'factiv'), { recursive: true })
    mkdirSync(join(tmpRoot, 'Sourcecode', 'neuroflash'), { recursive: true })
  })

  afterEach(() => cleanup())

  // Helper: build fake COVERAGE_ROOTS bound to tmpRoot
  function fakeRoots() {
    return {
      agenticapps: () => join(tmpRoot, 'Sourcecode', 'agenticapps'),
      factiv: () => join(tmpRoot, 'Sourcecode', 'factiv'),
      neuroflash: () => join(tmpRoot, 'Sourcecode', 'neuroflash'),
    }
  }

  it('resolveAllowedNamed rejects file outside all roots (outside allowed roots)', async () => {
    const roots = fakeRoots()
    const outsideDir = mkdtempSync(join(tmpdir(), 'outside-'))
    const outsidePath = join(outsideDir, 'foo.md')
    writeFileSync(outsidePath, 'secret')
    try {
      await expect(
        resolveAllowedNamed(outsidePath, {
          roots: [roots.agenticapps()],
          containment: { kind: 'repository-root' },
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
          containment: { kind: 'repository-root' },
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
        containment: { kind: 'repository-root' },
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
      resolveAllowed(projectRoot, '../../../outside.txt'),
    ).rejects.toBeInstanceOf(PathViolation)
  })

  it('resolveAllowedNamed accepts .md file inside neuroflash root using extension form', async () => {
    const roots = fakeRoots()
    const mdPath = join(roots.neuroflash(), 'README.md')
    writeFileSync(mdPath, '# readme')
    const result = await resolveAllowedNamed(mdPath, {
      roots: [roots.neuroflash()],
      containment: { kind: 'repository-root' },
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
        containment: { kind: 'repository-root' },
        extension: '.md',
      }),
    ).rejects.toBeInstanceOf(PathViolation)
  })
})
