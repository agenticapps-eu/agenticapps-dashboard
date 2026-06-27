/**
 * registryPathDrift.test.ts — Detector + suggested-path inference (D-12-18, D-12-21).
 *
 * Plan 12-02 Task 2 (RED first).
 *
 * Defences exercised:
 *   - existsSync false → reason: 'missing'
 *   - realpath ≠ stored canonical → reason: 'symlink-target-changed'
 *   - .git/config origin remote does not match family-root prefix → reason: 'git-remote-changed'
 *   - suggested-path inference reads .git/config via fs.readFile + regex (NO subprocess)
 *   - Never throws on registry-read failure; never throws on symlink loops
 *   - Output shape strictly matches PathDriftEntrySchema (Wave 0 schema)
 */
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
  realpathSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { PathDriftEntrySchema } from '@agenticapps/dashboard-shared'

// Mock registry.ts BEFORE importing the unit under test so the detector
// pulls a controlled in-memory registry instead of touching ~/.agenticapps.
vi.mock('./registry.js', async () => {
  const actual = await vi.importActual<typeof import('./registry.js')>('./registry.js')
  return {
    ...actual,
    readRegistry: vi.fn(),
  }
})

// Mock paths.ts so COVERAGE_ROOTS resolves to a per-test sandbox.
vi.mock('./paths.js', async () => {
  const actual = await vi.importActual<typeof import('./paths.js')>('./paths.js')
  return {
    ...actual,
    COVERAGE_ROOTS: {
      gitnexus: () => '/tmp/no-such-gitnexus-fixture',
      agenticapps: () => '/tmp/no-such-agenticapps-fixture',
      factiv: () => '/tmp/no-such-factiv-fixture',
      neuroflash: () => '/tmp/no-such-neuroflash-fixture',
    },
  }
})

// Spy on fs.promises.readFile so the F9 perf test can count how many times
// candidate `.git/config` files get read across one detectPathDrift cycle.
// Call-through preserves behaviour for every other test.
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
  }
})

import { readFile as mockedReadFile } from 'node:fs/promises'
import { detectPathDrift, inferSuggestedPath } from './registryPathDrift.js'
import { readRegistry } from './registry.js'
import { COVERAGE_ROOTS } from './paths.js'

// Tracks one tmp root per test so cleanup can wipe it.
let tmpRoot: string
let cleanup: () => void

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks resets the spy state but keeps the call-through implementation
  // (vi.fn(actual.readFile) at module-mock time). No need to re-wire here.
  tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-drift-')))
  cleanup = () => rmSync(tmpRoot, { recursive: true, force: true })
})

afterEach(() => {
  cleanup()
})

function pointFamilyRoot(family: 'agenticapps' | 'factiv' | 'neuroflash', dir: string): void {
  // COVERAGE_ROOTS is `as const` in the real module — the mock is mutable
  // for testability; cast away readonly to mirror per-test overrides.
  ;(COVERAGE_ROOTS as unknown as Record<string, () => string>)[family] = () => dir
}

function makeRegistryEntry(id: string, root: string) {
  return {
    id,
    name: id,
    root,
    client: null,
    addedAt: '2026-05-19T12:00:00.000Z',
    tags: [],
  }
}

describe('registryPathDrift › detectPathDrift', () => {
  it('returns [] when the registry has no projects', async () => {
    vi.mocked(readRegistry).mockReturnValue({ version: 1, projects: [] })
    const result = await detectPathDrift()
    expect(result).toEqual([])
  })

  it('emits reason: missing when the stored root does not exist on disk', async () => {
    const missingPath = join(tmpRoot, 'never-created')
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [makeRegistryEntry('ghost', missingPath)],
    })
    const result = await detectPathDrift()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'ghost',
      storedPath: missingPath,
      reason: 'missing',
      suggestedPath: null,
    })
  })

  it('emits reason: symlink-target-changed when realpath differs from canonicaliseRoot', async () => {
    // Create a real target dir + a symlink at a different location that
    // points to it. The registry stored the symlink path; realpath will
    // resolve to the actual target so the two diverge.
    const real = join(tmpRoot, 'real-target')
    mkdirSync(real)
    const linkParent = join(tmpRoot, 'link-parent')
    mkdirSync(linkParent)
    const link = join(linkParent, 'symlinked')
    symlinkSync(real, link)

    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [makeRegistryEntry('linked', link)],
    })
    const result = await detectPathDrift()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'linked',
      storedPath: link,
      reason: 'symlink-target-changed',
    })
  })

  it('emits reason: git-remote-changed when .git/config origin no longer matches any family root', async () => {
    // Stored project is inside the tmp tree (so existsSync passes + realpath
    // matches) but no family root contains it → must drift as
    // git-remote-changed when .git/config has an origin we cannot match.
    const orphan = join(tmpRoot, 'orphan-repo')
    mkdirSync(join(orphan, '.git'), { recursive: true })
    writeFileSync(
      join(orphan, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:someone/orphan-repo.git\n',
    )
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [makeRegistryEntry('orphan', orphan)],
    })
    const result = await detectPathDrift()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'orphan',
      storedPath: orphan,
      reason: 'git-remote-changed',
      suggestedPath: null, // no family roots configured for the test sandbox
    })
  })

  it('returns suggestedPath: null when inference cannot find a matching dir', async () => {
    const orphan = join(tmpRoot, 'orphan2')
    mkdirSync(join(orphan, '.git'), { recursive: true })
    writeFileSync(
      join(orphan, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:nobody/nothing.git\n',
    )
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [makeRegistryEntry('orphan2', orphan)],
    })
    const result = await detectPathDrift()
    expect(result[0]?.suggestedPath).toBeNull()
  })

  it('detector NEVER throws on registry-read failure (returns [])', async () => {
    vi.mocked(readRegistry).mockImplementation(() => {
      throw new Error('synthetic registry failure')
    })
    const result = await detectPathDrift()
    expect(result).toEqual([])
  })

  it('detector NEVER throws on symlink loops in entry.root', async () => {
    // self-referencing symlink loop
    const loop = join(tmpRoot, 'loop')
    symlinkSync(loop, loop) // node will refuse to dereference
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [makeRegistryEntry('loop', loop)],
    })
    await expect(detectPathDrift()).resolves.toBeDefined()
  })

  it('returns entries shaped exactly per PathDriftEntrySchema (Wave 0)', async () => {
    const missingPath = join(tmpRoot, 'still-missing')
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [makeRegistryEntry('missing', missingPath)],
    })
    const result = await detectPathDrift()
    expect(() => PathDriftEntrySchema.parse(result[0])).not.toThrow()
  })
})

describe('registryPathDrift › inferSuggestedPath', () => {
  it('finds a matching dir by .git/config remote.origin.url', async () => {
    // Build a family-root sandbox with two candidate dirs; one carries the
    // origin URL we want to match.
    const family = join(tmpRoot, 'fake-agenticapps')
    mkdirSync(family)
    const a = join(family, 'a')
    mkdirSync(join(a, '.git'), { recursive: true })
    writeFileSync(
      join(a, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:org/a.git\n',
    )
    const b = join(family, 'b')
    mkdirSync(join(b, '.git'), { recursive: true })
    writeFileSync(
      join(b, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:org/b.git\n',
    )
    pointFamilyRoot('agenticapps', family)

    const result = await inferSuggestedPath('git@github.com:org/b.git')
    expect(result).toBe(realpathSync(b))
  })

  it('returns null when .git/config is unreadable (no candidate matches)', async () => {
    const family = join(tmpRoot, 'fake-agenticapps-empty')
    mkdirSync(family)
    pointFamilyRoot('agenticapps', family)

    const result = await inferSuggestedPath('git@github.com:nobody/x.git')
    expect(result).toBeNull()
  })

  it('returns null when origin URL does not match any candidate', async () => {
    const family = join(tmpRoot, 'fake-agenticapps-nomatch')
    mkdirSync(family)
    const c = join(family, 'c')
    mkdirSync(join(c, '.git'), { recursive: true })
    writeFileSync(
      join(c, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:other/c.git\n',
    )
    pointFamilyRoot('agenticapps', family)

    const result = await inferSuggestedPath('git@github.com:org/never.git')
    expect(result).toBeNull()
  })

  it('reads ONLY .git/config inside family roots (SECURITY)', async () => {
    // Plant a candidate with an origin URL we will look for. Also place a
    // ".git/config" file at a non-family location with the same URL — the
    // function must NOT discover it via cross-family scanning.
    const family = join(tmpRoot, 'fake-factiv')
    mkdirSync(family)
    const inside = join(family, 'allowed')
    mkdirSync(join(inside, '.git'), { recursive: true })
    writeFileSync(
      join(inside, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:findme/yes.git\n',
    )
    // Outside-family candidate with the SAME URL — must not be returned.
    const outsideHost = join(tmpRoot, 'outside-host')
    mkdirSync(join(outsideHost, '.git'), { recursive: true })
    writeFileSync(
      join(outsideHost, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:findme/yes.git\n',
    )
    pointFamilyRoot('factiv', family)

    const result = await inferSuggestedPath('git@github.com:findme/yes.git')
    expect(result).toBe(realpathSync(inside))
    expect(result).not.toBe(realpathSync(outsideHost))
  })

  it('returns null when no family roots exist on disk', async () => {
    // All COVERAGE_ROOTS point at non-existent paths by default; ensure
    // the function does not throw and returns null.
    const result = await inferSuggestedPath('git@github.com:anyone/anywhere.git')
    expect(result).toBeNull()
  })

  it('does NOT cross section boundaries when parsing .git/config (REGRESSION)', async () => {
    // Regression for the previous single-regex parser that would return
    // the upstream URL as origin's when origin had no `url =` line. A
    // section-anchored parser must return null here, NOT the upstream URL.
    const family = join(tmpRoot, 'fake-agenticapps-crosssec')
    mkdirSync(family)
    const candidate = join(family, 'crosssec')
    mkdirSync(join(candidate, '.git'), { recursive: true })
    writeFileSync(
      join(candidate, '.git', 'config'),
      // origin has NO url, upstream does — must not be borrowed.
      '[remote "origin"]\n[remote "upstream"]\n\turl = git@github.com:other/x.git\n',
    )
    pointFamilyRoot('agenticapps', family)

    // The upstream URL should NOT be discovered as a match for origin.
    const result = await inferSuggestedPath('git@github.com:other/x.git')
    expect(result).toBeNull()
  })

  // ── Testing #11 — malformed `.git/config` shapes the per-section parser must reject ───
  //
  // Post per-section parser (fix #2): `[remote "origin"]` followed by no body
  // and nothing else MUST yield null, NOT a leaked url from elsewhere or a
  // throw. This shape is distinct from the cross-section regression above
  // (origin + sibling upstream with a url): here there is nothing TO borrow
  // from, so the assertion pins the no-url branch directly.
  it('Testing #11 [malformed .git/config]: origin section with no url and nothing else → null', async () => {
    const family = join(tmpRoot, 'fake-agenticapps-empty-origin')
    mkdirSync(family)
    const candidate = join(family, 'empty-origin')
    mkdirSync(join(candidate, '.git'), { recursive: true })
    writeFileSync(
      join(candidate, '.git', 'config'),
      '[remote "origin"]\n',
    )
    pointFamilyRoot('agenticapps', family)

    // Any URL lookup against this family must return null — the only
    // candidate has an origin section with no url key.
    const result = await inferSuggestedPath('git@github.com:any/thing.git')
    expect(result).toBeNull()
  })
})

/**
 * F9 (Adversarial, confidence 7/10) — `inferSuggestedPath` is O(F × M × readFile)
 * per drift cycle. With many drifted entries, each call re-scans every family
 * root and re-reads every candidate `.git/config`. Total cost balloons to
 * O(D × F × M × readFile) per drift cycle.
 *
 * Fix shape: build the origin-URL → realpath index ONCE per `detectPathDrift`
 * cycle and reuse it for every drifted entry's lookup.
 */
describe('registryPathDrift › F9: per-cycle origin-index reuse', () => {
  it('reads each candidate .git/config at most once per detectPathDrift cycle, regardless of how many drifted entries exist', async () => {
    // Family root with two candidate dirs, distinct origin URLs.
    const family = join(tmpRoot, 'fake-agenticapps-perf')
    mkdirSync(family)
    const c1 = join(family, 'c1')
    mkdirSync(join(c1, '.git'), { recursive: true })
    writeFileSync(
      join(c1, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:org/c1.git\n',
    )
    const c2 = join(family, 'c2')
    mkdirSync(join(c2, '.git'), { recursive: true })
    writeFileSync(
      join(c2, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:org/c2.git\n',
    )
    pointFamilyRoot('agenticapps', family)

    // Three drifted orphan repos OUTSIDE any family root, each pointing at
    // c1's origin URL — every one of them will request inferSuggestedPath.
    const orphans = ['o1', 'o2', 'o3'].map((id) => {
      const dir = join(tmpRoot, `orphan-${id}`)
      mkdirSync(join(dir, '.git'), { recursive: true })
      writeFileSync(
        join(dir, '.git', 'config'),
        '[remote "origin"]\n\turl = git@github.com:org/c1.git\n',
      )
      return { id, dir }
    })
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: orphans.map((o) => makeRegistryEntry(o.id, o.dir)),
    })

    const result = await detectPathDrift()
    expect(result).toHaveLength(3)
    expect(result.every((e) => e.suggestedPath === realpathSync(c1))).toBe(true)

    // Count how many times the family-root candidate `.git/config` files were
    // read during this cycle. With per-cycle index reuse, each candidate is
    // scanned ONCE for the entire cycle (M reads total). Without the fix,
    // each drifted entry re-scans → D × M reads.
    const familyRealpath = realpathSync(family)
    const candidateConfigReads = vi.mocked(mockedReadFile).mock.calls.filter(([p]) => {
      if (typeof p !== 'string') return false
      return p.startsWith(familyRealpath + sep) && p.endsWith(`${sep}.git${sep}config`)
    }).length
    expect(candidateConfigReads).toBeLessThanOrEqual(2)
  })
})

/**
 * F10 (Adversarial, confidence 5/10) — `inferSuggestedPath` calls `readFile`
 * (via readGitOrigin) and `realpath` on candidates discovered through
 * `readdirSync(familyRoot)`. A symlink candidate inside a family root would
 * be followed, allowing an attacker who can write to the family root to plant
 * a symlink whose target carries a chosen origin URL and trick the detector
 * into "suggesting" an out-of-family path.
 *
 * Fix shape: `lstat` each candidate before descent and skip if
 * `isSymbolicLink()` returns true.
 */
describe('registryPathDrift › F10: skip symlink candidates inside a family root', () => {
  it('inferSuggestedPath ignores a symlink candidate even when its target carries the matching origin URL', async () => {
    // Family root contains ONLY a symlink. The symlink target is a real repo
    // OUTSIDE the family root with a matching origin URL.
    const family = join(tmpRoot, 'fake-agenticapps-symlink')
    mkdirSync(family)
    const realOutside = join(tmpRoot, 'outside-real-repo')
    mkdirSync(join(realOutside, '.git'), { recursive: true })
    writeFileSync(
      join(realOutside, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:attacker/match.git\n',
    )
    symlinkSync(realOutside, join(family, 'linked'))
    pointFamilyRoot('agenticapps', family)

    const result = await inferSuggestedPath('git@github.com:attacker/match.git')
    expect(result).toBeNull()
  })

  it('inferSuggestedPath still finds a non-symlink candidate alongside a symlink in the same family root', async () => {
    // Mixed family root: one symlink (must be skipped) + one real repo with
    // a matching URL (must be found).
    const family = join(tmpRoot, 'fake-agenticapps-mixed')
    mkdirSync(family)

    const realOutside = join(tmpRoot, 'outside-real-repo-2')
    mkdirSync(join(realOutside, '.git'), { recursive: true })
    writeFileSync(
      join(realOutside, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:lure/match.git\n',
    )
    symlinkSync(realOutside, join(family, 'lure'))

    const realInside = join(family, 'real-inside')
    mkdirSync(join(realInside, '.git'), { recursive: true })
    writeFileSync(
      join(realInside, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:org/legit.git\n',
    )
    pointFamilyRoot('agenticapps', family)

    expect(await inferSuggestedPath('git@github.com:lure/match.git')).toBeNull()
    expect(await inferSuggestedPath('git@github.com:org/legit.git')).toBe(realpathSync(realInside))
  })
})
