/**
 * projectMetadataScan.anchor.test.ts — proves an ORDERING property, which is why
 * it lives in its own file with a spy rather than beside the other scan tests.
 *
 * Raised by the codex reviewer in round 2: asserting that
 * `parseCiWorkflowsForSentry` returns `[]` for an escaping `.github/workflows`
 * does not prove nothing outside was read. It returned `[]` either way — once
 * because each file was refused, and once because the directory was never
 * listed. Only the second is the behaviour the spec asks for, and the
 * difference is a syscall, not a value.
 *
 * So this spies on `readdir` and asserts the escaped directory is never passed
 * to it. `readdir` is promisified at module load, so the spy has to be in place
 * before the module under test is imported — hence `vi.mock` with a passthrough
 * to the real implementation.
 */
import { join } from 'node:path'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { describe, it, expect, vi, afterEach } from 'vitest'

const readdirSpy = vi.hoisted(() => ({ calls: [] as string[] }))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readdir: ((path: string, ...rest: unknown[]) => {
      readdirSpy.calls.push(String(path))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actual.readdir as any)(path, ...rest)
    }) as typeof actual.readdir,
  }
})

const { parseCiWorkflowsForSentry } = await import('./projectMetadataScan.js')

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
  readdirSpy.calls.length = 0
})

function makeTemp(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  temps.push(dir)
  return dir
}

describe('parseCiWorkflowsForSentry — anchoring precedes enumeration', () => {
  it('never lists a .github/workflows that is a symlink out of the project', async () => {
    const root = makeTemp('ci-anchor-root-')
    const outside = makeTemp('ci-anchor-outside-')
    writeFileSync(join(outside, 'release.yml'), 'run: sentry-cli releases new\n')
    mkdirSync(join(root, '.github'), { recursive: true })
    symlinkSync(outside, join(root, '.github', 'workflows'), 'dir')

    const result = await parseCiWorkflowsForSentry(root)

    expect(result).toEqual([])
    // The point of the test: the outside directory was never enumerated.
    expect(readdirSpy.calls.some((path) => path.includes(outside))).toBe(false)
    expect(readdirSpy.calls.some((path) => path.includes('workflows'))).toBe(false)
  })

  it('does list an ordinary in-project .github/workflows', async () => {
    const root = makeTemp('ci-anchor-ok-')
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'run: sentry-cli releases new\n')

    const result = await parseCiWorkflowsForSentry(root)

    expect(result.some((signal) => signal.signal === 'sentry-cli-ci')).toBe(true)
    expect(readdirSpy.calls.some((path) => path.includes('workflows'))).toBe(true)
  })
})
