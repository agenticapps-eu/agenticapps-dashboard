/**
 * containmentAdmission.characterisation.test.ts — pins what the two resolvers
 * ADMIT and REFUSE today, before `containment` exists.
 *
 * This file is a baseline, not a feature test. `require-anchor-on-path-resolution`
 * claims to be purely declarative: a required field and no change in admission.
 * That claim is only falsifiable if the current behaviour is written down first,
 * so these tests must pass UNMODIFIED after the change lands. Editing one of
 * them to make it pass is the signal that admission moved and that a site was
 * misclassified — see tasks.md §4.4.
 *
 * Two of these cases exist because plan review round 1 falsified the design's
 * first draft with them, and neither was covered anywhere:
 *
 *  - `admits under the standing family roots alone` — the draft would have sent
 *    `repository-root` down the ANCHORED branch, which uses `callerRoots` alone
 *    (coverageResolver.ts:186). Every scanner read that reaches a sibling repo
 *    through the family roots would have started refusing, and nothing would
 *    have caught it.
 *  - `admits through the lexical fallback when the root has a .. component` —
 *    the draft argued this was unreachable, inheriting an argument made about
 *    the sync resolver in #100. It is reachable: realpath() must resolve
 *    `missing/..` and throws, while resolve() normalises it away.
 */

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { realpath } from 'node:fs/promises'
import { join, sep, resolve } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCoverageResolver, PathViolation as CoveragePathViolation } from './coverageResolver.js'
import type { PathResolver } from './coverageResolver.js'
import { resolveAllowedNamed, PathViolation as PathsPathViolation } from './paths.js'

// The two resolvers throw two DIFFERENT PathViolation classes — `paths.ts:34`
// and `coverageResolver.ts:26`. Pre-existing, out of scope here, and noted
// because an `instanceof` against the wrong one passes as an Error and fails as
// a PathViolation, which reads as a behaviour change when it is an import bug.

const temps: string[] = []

function makeTemp(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  temps.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

// ── resolveAllowedNamed (async) ───────────────────────────────────────────────

describe('characterisation: resolveAllowedNamed admission', () => {
  it('admits a named file under a root that is the repository root', async () => {
    const root = makeTemp('char-rn-root-')
    writeFileSync(join(root, 'package.json'), '{}')

    await expect(
      resolveAllowedNamed(join(root, 'package.json'), {
        roots: [root],
        allowedNames: ['package.json'],
      }),
    ).resolves.toBe(join(root, 'package.json'))
  })

  it('refuses a file whose realpath leaves the root', async () => {
    const root = makeTemp('char-rn-in-')
    const outside = makeTemp('char-rn-out-')
    writeFileSync(join(outside, 'package.json'), '{}')
    symlinkSync(join(outside, 'package.json'), join(root, 'package.json'))

    await expect(
      resolveAllowedNamed(join(root, 'package.json'), {
        roots: [root],
        allowedNames: ['package.json'],
      }),
    ).rejects.toBeInstanceOf(PathsPathViolation)
  })

  it('refuses a name outside the allow-list', async () => {
    const root = makeTemp('char-rn-name-')
    writeFileSync(join(root, 'secrets.txt'), 'x')

    await expect(
      resolveAllowedNamed(join(root, 'secrets.txt'), {
        roots: [root],
        allowedNames: ['package.json'],
      }),
    ).rejects.toBeInstanceOf(PathsPathViolation)
  })

  it('anchored: refuses when the supplied root has left the anchor', async () => {
    const root = makeTemp('char-rn-anch-')
    const outside = makeTemp('char-rn-anch-out-')
    writeFileSync(join(outside, 'ci.yml'), 'on: push')
    mkdirSync(join(root, '.github'), { recursive: true })
    symlinkSync(outside, join(root, '.github', 'workflows'), 'dir')

    await expect(
      resolveAllowedNamed(join(root, '.github', 'workflows', 'ci.yml'), {
        roots: [join(root, '.github', 'workflows')],
        extension: '.yml',
        anchorTo: root,
      }),
    ).rejects.toBeInstanceOf(PathsPathViolation)
  })

  it('admits through the lexical fallback when the root has a .. component', async () => {
    // The case that falsified the draft's D2. realpath() must resolve every
    // component, so it throws ENOENT on `missing/..`; resolve() normalises the
    // `..` away to <root>, under which the candidate resolves and is admitted.
    // Unanchored calls keep this fallback, so this MUST still be admitted.
    //
    // The root is built by CONCATENATION, not join(): join() normalises
    // `missing/..` away itself, producing a plain resolvable root and a test
    // that asserts nothing. It did exactly that until a deliberate mutation
    // failed to break it.
    const root = makeTemp('char-rn-dotdot-')
    writeFileSync(join(root, 'package.json'), '{}')
    const rootWithDotDot = `${root}${sep}missing${sep}..`

    await expect(realpath(rootWithDotDot)).rejects.toThrow() // the premise
    expect(resolve(rootWithDotDot)).toBe(root) // …and the fallback it takes

    await expect(
      resolveAllowedNamed(join(root, 'package.json'), {
        roots: [rootWithDotDot],
        allowedNames: ['package.json'],
      }),
    ).resolves.toBe(join(root, 'package.json'))
  })
})

// ── PathResolver (sync, coverage roots) ───────────────────────────────────────

describe('characterisation: PathResolver admission', () => {
  let home: string
  let family: string
  let resolve: PathResolver

  beforeEach(() => {
    home = makeTemp('char-pr-home-')
    family = join(home, 'agenticapps')
    mkdirSync(family, { recursive: true })
    resolve = makeCoverageResolver({ sourcecodeRoot: home })
  })

  it('admits a caller-supplied repository root', () => {
    const repo = join(family, 'repo-a')
    mkdirSync(repo, { recursive: true })
    writeFileSync(join(repo, 'package.json'), '{}')

    expect(
      resolve(join(repo, 'package.json'), {
        roots: [repo],
        allowedNames: ['package.json'],
      }),
    ).toBe(join(repo, 'package.json'))
  })

  it('admits under the standing family roots alone', () => {
    // The admission the draft's D2 would have destroyed: the candidate lies
    // under NO caller-supplied root, and is admitted only because the resolver's
    // own family roots are merged in on the unanchored branch. `repository-root`
    // must keep routing here.
    const sibling = join(family, 'repo-b')
    mkdirSync(sibling, { recursive: true })
    writeFileSync(join(sibling, 'package.json'), '{}')

    const unrelated = join(family, 'repo-a')
    mkdirSync(unrelated, { recursive: true })

    expect(
      resolve(join(sibling, 'package.json'), {
        roots: [unrelated],
        allowedNames: ['package.json'],
      }),
    ).toBe(join(sibling, 'package.json'))
  })

  it('refuses a path under neither the caller roots nor the family roots', () => {
    const outside = makeTemp('char-pr-out-')
    writeFileSync(join(outside, 'package.json'), '{}')

    expect(() =>
      resolve(join(outside, 'package.json'), {
        roots: [family],
        allowedNames: ['package.json'],
      }),
    ).toThrow(CoveragePathViolation)
  })

  it('anchored: the family roots do NOT rescue an escaped caller root', () => {
    // The D7 rule from #100, pinned here so the split between the two branches
    // stays visible next to the admission it denies.
    const repo = join(family, 'repo-c')
    const sibling = join(family, 'repo-d')
    mkdirSync(repo, { recursive: true })
    mkdirSync(sibling, { recursive: true })
    writeFileSync(join(sibling, 'package.json'), '{}')
    symlinkSync(sibling, join(repo, 'skills'), 'dir')

    expect(() =>
      resolve(join(repo, 'skills', 'package.json'), {
        roots: [join(repo, 'skills')],
        allowedNames: ['package.json'],
        anchorTo: repo,
      }),
    ).toThrow(CoveragePathViolation)
  })
})
