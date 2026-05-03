import { describe, it, expect, afterEach } from 'vitest'
import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { makeTmpProject } from './__fixtures__/tmpHome.js'
import { resolveAllowed, PathViolation } from './paths.js'

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
