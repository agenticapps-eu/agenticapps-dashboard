/**
 * containment.test.ts — the declaration is equivalent to what it replaces.
 *
 * The claim this change rests on is that `containment` reclassifies calls
 * without changing resolution. These tests are that claim stated executably:
 * for each variant, the declared call and the equivalent legacy call agree on
 * the same inputs — including the two inputs plan review round 1 used to
 * falsify the design's first draft.
 *
 * Path fixtures are built by CONCATENATION where they contain `..`; `join()`
 * normalises it away and produces a fixture without the pathology it names.
 * See tasks.md §5.
 */

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  makeCoverageResolver,
  PathViolation as CoveragePathViolation,
} from './coverageResolver.js'
import type { PathResolver } from './coverageResolver.js'
import { resolveAllowedNamed, PathViolation as PathsPathViolation } from './paths.js'
import { DAEMON_NAMED_REASONS } from './containment.js'

const temps: string[] = []

function makeTemp(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  temps.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('containment — malformed declarations', () => {
  // The migration-window guard (anchorTo AND containment together is a
  // PathViolation) is deliberately absent: `anchorTo` no longer exists, so the
  // contradiction it caught is now unrepresentable. The check remains in the
  // resolvers for nothing, which is the correct end state for a guard whose job
  // was to survive a window that has closed.

  it('refuses a daemon-named declaration whose reason is blank', async () => {
    const root = makeTemp('cont-blank-')
    writeFileSync(join(root, 'package.json'), '{}')

    await expect(
      resolveAllowedNamed(join(root, 'package.json'), {
        roots: [root],
        allowedNames: ['package.json'],
        containment: { kind: 'daemon-named', rootId: 'claude-skills', reason: '   ' },
      }),
    ).rejects.toBeInstanceOf(PathsPathViolation)
  })

  it('ships a non-empty reason for every enumerated named root', () => {
    for (const [rootId, reason] of Object.entries(DAEMON_NAMED_REASONS)) {
      expect(reason.trim(), `${rootId} must state why it is not anchored`).not.toBe('')
    }
    // Five machine roots and four family roots. The family half was added
    // during the migration, when `workflowScan.ts:64` turned out to supply a
    // family root and the three-variant union could not describe it.
    expect(Object.keys(DAEMON_NAMED_REASONS).sort()).toEqual([
      'agenticapps-bin',
      'claude-skills',
      'codex-skills',
      'family-agenticapps',
      'family-factiv',
      'family-neuroflash',
      'opencode-skills',
      'pi-skills',
      'workflow-migrations',
    ])
  })
})

describe('containment — declaring a call does not change resolution', () => {
  it('anchored resolves exactly as anchorTo did, admitting', async () => {
    const root = makeTemp('cont-anch-ok-')
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'on: push')
    const target = join(root, '.github', 'workflows', 'ci.yml')
    const roots = [join(root, '.github', 'workflows')]

    const declared = await resolveAllowedNamed(target, {
      roots,
      extension: '.yml',
      containment: { kind: 'anchored', root },
    })

    expect(declared).toBe(target)
  })

  it('anchored refuses exactly as anchorTo did, on an escaped boundary', async () => {
    const root = makeTemp('cont-anch-esc-')
    const outside = makeTemp('cont-anch-esc-out-')
    writeFileSync(join(outside, 'ci.yml'), 'on: push')
    mkdirSync(join(root, '.github'), { recursive: true })
    symlinkSync(outside, join(root, '.github', 'workflows'), 'dir')
    const target = join(root, '.github', 'workflows', 'ci.yml')
    const roots = [join(root, '.github', 'workflows')]

    await expect(
      resolveAllowedNamed(target, {
        roots,
        extension: '.yml',
        containment: { kind: 'anchored', root },
      }),
    ).rejects.toBeInstanceOf(PathsPathViolation)
  })

  it('repository-root keeps the lexical fallback an undeclared call has', async () => {
    // The input that falsified the draft's D2. Declaring must not start refusing it.
    const root = makeTemp('cont-repo-dotdot-')
    writeFileSync(join(root, 'package.json'), '{}')
    const roots = [`${root}${sep}missing${sep}..`]

    const declared = await resolveAllowedNamed(join(root, 'package.json'), {
      roots,
      allowedNames: ['package.json'],
      containment: { kind: 'repository-root' },
    })

    expect(declared).toBe(join(root, 'package.json'))
  })
})

describe('containment — PathResolver keeps its standing roots when unanchored', () => {
  let home: string
  let family: string
  let resolve: PathResolver

  beforeEach(() => {
    home = makeTemp('cont-pr-home-')
    family = join(home, 'agenticapps')
    mkdirSync(family, { recursive: true })
    resolve = makeCoverageResolver({ sourcecodeRoot: home })
  })

  it('repository-root is still admitted under the family roots alone', () => {
    // `repository-root` is NOT a claim of confinement. This is the admission the
    // draft would have destroyed by routing it to the anchored branch.
    const sibling = join(family, 'repo-b')
    const unrelated = join(family, 'repo-a')
    mkdirSync(sibling, { recursive: true })
    mkdirSync(unrelated, { recursive: true })
    writeFileSync(join(sibling, 'package.json'), '{}')

    expect(
      resolve(join(sibling, 'package.json'), {
        roots: [unrelated],
        allowedNames: ['package.json'],
        containment: { kind: 'repository-root' },
      }),
    ).toBe(join(sibling, 'package.json'))
  })

  it('daemon-named is still admitted under the family roots alone', () => {
    const sibling = join(family, 'repo-c')
    const unrelated = join(family, 'repo-d')
    mkdirSync(sibling, { recursive: true })
    mkdirSync(unrelated, { recursive: true })
    writeFileSync(join(sibling, 'package.json'), '{}')

    expect(
      resolve(join(sibling, 'package.json'), {
        roots: [unrelated],
        allowedNames: ['package.json'],
        containment: {
          kind: 'daemon-named',
          rootId: 'claude-skills',
          reason: DAEMON_NAMED_REASONS['claude-skills'],
        },
      }),
    ).toBe(join(sibling, 'package.json'))
  })

  it('anchored still excludes the family roots', () => {
    const repo = join(family, 'repo-e')
    const sibling = join(family, 'repo-f')
    mkdirSync(repo, { recursive: true })
    mkdirSync(sibling, { recursive: true })
    writeFileSync(join(sibling, 'package.json'), '{}')
    symlinkSync(sibling, join(repo, 'skills'), 'dir')

    expect(() =>
      resolve(join(repo, 'skills', 'package.json'), {
        roots: [join(repo, 'skills')],
        allowedNames: ['package.json'],
        containment: { kind: 'anchored', root: repo },
      }),
    ).toThrow(CoveragePathViolation)
  })

  it('refuses a daemon-named declaration whose reason is blank', () => {
    const repo = join(family, 'repo-g')
    mkdirSync(repo, { recursive: true })
    writeFileSync(join(repo, 'package.json'), '{}')

    expect(() =>
      resolve(join(repo, 'package.json'), {
        roots: [repo],
        allowedNames: ['package.json'],
        containment: { kind: 'daemon-named', rootId: 'claude-skills', reason: '' },
      }),
    ).toThrow(CoveragePathViolation)
  })
})

describe('containment — the marker-directory escape found during migration', () => {
  /**
   * `workflowDeriver.ts` read a host SKILL.md with
   * `roots: [join(root, host.marker), root]` and NO anchor, where `host.marker`
   * is `.claude` / `.codex` / `.opencode` / `.pi`.
   *
   * That is the derived boundary `<repo>/.claude` — named explicitly by the
   * anchoring requirement — used as a containment boundary without being
   * anchored. Roots are alternatives, so a marker symlinked out of the
   * repository admits reads under its target regardless of the sound `root`
   * sitting beside it. #100 closed this at six sites and did not reach this one.
   *
   * The first assertion is the escape; the second is that anchoring refuses it.
   *
   * Both pass `containment` literally, so what they pin is the SHAPE, not the
   * call site: they would keep passing if `workflowDeriver` reverted to an
   * unanchored declaration. Pinning the call site needs a deriveWorkflow-level
   * fixture, which is recorded as outstanding in the change's §5 rather than
   * claimed here.
   */
  it('admits a read through a symlinked marker directory when unanchored', async () => {
    const repo = makeTemp('marker-esc-repo-')
    const outside = makeTemp('marker-esc-out-')
    writeFileSync(join(outside, 'SKILL.md'), '---\nname: x\n---\n')
    symlinkSync(outside, join(repo, '.claude'), 'dir')

    const admitted = await resolveAllowedNamed(join(repo, '.claude', 'SKILL.md'), {
      roots: [join(repo, '.claude'), repo],
      allowedNames: ['SKILL.md'],
      containment: { kind: 'repository-root' },
    })

    // The escape, stated rather than implied: a file outside the repository.
    expect(admitted.startsWith(outside)).toBe(true)
  })

  it('refuses that same read once the boundary is anchored', async () => {
    const repo = makeTemp('marker-fix-repo-')
    const outside = makeTemp('marker-fix-out-')
    writeFileSync(join(outside, 'SKILL.md'), '---\nname: x\n---\n')
    symlinkSync(outside, join(repo, '.claude'), 'dir')

    await expect(
      resolveAllowedNamed(join(repo, '.claude', 'SKILL.md'), {
        roots: [join(repo, '.claude'), repo],
        allowedNames: ['SKILL.md'],
        containment: { kind: 'anchored', root: repo },
      }),
    ).rejects.toBeInstanceOf(PathsPathViolation)
  })
})
