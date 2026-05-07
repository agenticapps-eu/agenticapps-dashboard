import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, symlinkSync } from 'node:fs'

import { describe, it, expect, afterEach } from 'vitest'

import { makeTmpProject } from './__fixtures__/tmpHome.js'
import { resolveAllowed, resolveAllowedNamed, PathViolation } from './paths.js'

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
