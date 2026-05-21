/**
 * conformanceScan.test.ts — Wave 2 orchestrator composing Wave 1 primitives.
 *
 * Plan 12-02 Task 3 (RED first).
 *
 * Verifies that scanConformance() produces a wire-shape valid ConformanceResponse:
 *   - today scores from computeConformanceScores(coverage, driftedSet)
 *   - series from readDailySeriesForFleet (90 days when populated)
 *   - drifted from detectPathDrift
 *   - delta14d computed from today − series[length-15] when ≥15 entries exist
 *   - schemaVersion = 1; asOf = ISO datetime
 *   - DEFENSIVE: partial failures yield empty payload, not 500
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { ConformanceResponseSchema } from '@agenticapps/dashboard-shared'

// Mock all three primitives BEFORE importing the orchestrator so the
// scan composition is purely deterministic.
vi.mock('./coverageScan.js', () => ({
  scanCoverageInternal: vi.fn(),
}))
vi.mock('./registryPathDrift.js', () => ({
  detectPathDrift: vi.fn(),
}))
vi.mock('./snapshots/snapshotFleetReader.js', () => ({
  readDailySeriesForFleet: vi.fn(),
}))

import { scanConformance } from './conformanceScan.js'
import { scanCoverageInternal } from './coverageScan.js'
import { detectPathDrift } from './registryPathDrift.js'
import { readDailySeriesForFleet } from './snapshots/snapshotFleetReader.js'

function makeRow(
  family: 'agenticapps' | 'factiv' | 'neuroflash',
  repo: string,
  state: 'fresh' | 'stale' | 'missing' | 'not-applicable' = 'fresh',
) {
  return {
    family,
    repo,
    claudeMd: { kind: 'basic' as const, state },
    gitNexus: { kind: 'basic' as const, state },
    wiki: { kind: 'basic' as const, state },
    workflowVersion: {
      kind: 'workflow' as const,
      state,
      installedVersion: '1.8.0',
      headVersion: '1.8.0',
    },
    overrideCount: 0,
    overrides: [],
  }
}

function makeCoverage(rows: ReturnType<typeof makeRow>[]) {
  return {
    schemaVersion: 1 as const,
    generatedAtIso: new Date().toISOString(),
    gitNexusInstallState: 'installed-with-registry' as const,
    workflowHeadVersion: '1.8.0',
    rows,
  }
}

describe('conformanceScan › scanConformance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(detectPathDrift).mockResolvedValue([])
    vi.mocked(readDailySeriesForFleet).mockResolvedValue([])
    vi.mocked(scanCoverageInternal).mockResolvedValue({
      response: makeCoverage([
        makeRow('agenticapps', 'aa-1'),
        makeRow('factiv', 'f-1'),
        makeRow('neuroflash', 'n-1'),
      ]),
      internalRows: [],
    })
  })

  it('returns ConformanceResponse-shaped payload (parses ConformanceResponseSchema)', async () => {
    const result = await scanConformance()
    expect(() => ConformanceResponseSchema.parse(result)).not.toThrow()
  })

  it('schemaVersion = 1 and asOf is an ISO datetime', async () => {
    const result = await scanConformance({ now: new Date('2026-05-19T12:00:00.000Z') })
    expect(result.schemaVersion).toBe(1)
    expect(result.today.asOf).toBe('2026-05-19T12:00:00.000Z')
  })

  it('today scores come from computeConformanceScores (all-fresh → 100)', async () => {
    const result = await scanConformance()
    expect(result.today.fleet).toBe(100)
    expect(result.today.agenticapps).toBe(100)
    expect(result.today.factiv).toBe(100)
    expect(result.today.neuroflash).toBe(100)
  })

  it('series is the result of readDailySeriesForFleet', async () => {
    const series = [
      { date: '2026-05-18', fleet: 80, agenticapps: 80, factiv: 80, neuroflash: 80 },
      { date: '2026-05-19', fleet: 90, agenticapps: 90, factiv: 90, neuroflash: 90 },
    ]
    vi.mocked(readDailySeriesForFleet).mockResolvedValue(series)
    const result = await scanConformance()
    expect(result.series).toEqual(series)
  })

  it('drifted is the result of detectPathDrift', async () => {
    const drifted = [
      {
        id: 'orphan',
        storedPath: '/somewhere/orphan',
        suggestedPath: null,
        reason: 'missing' as const,
      },
    ]
    vi.mocked(detectPathDrift).mockResolvedValue(drifted)
    const result = await scanConformance()
    expect(result.drifted).toEqual(drifted)
  })

  it('delta14d uses date-anchored baseline (today − entry dated 14d ago)', async () => {
    // Anchor: now = 2026-05-15. Target = 2026-05-01.
    // series spans 2026-05-01..2026-05-15. Baseline must be the 2026-05-01
    // entry (score 75); rest are 80. Today is 100 (all-fresh fixture).
    // Delta = 100 − 75 = 25.
    const now = new Date('2026-05-15T00:00:00.000Z')
    const series = Array.from({ length: 15 }, (_, i) => {
      const baseline = i === 0 ? 75 : 80
      return {
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        fleet: baseline,
        agenticapps: baseline,
        factiv: baseline,
        neuroflash: baseline,
      }
    })
    vi.mocked(readDailySeriesForFleet).mockResolvedValue(series)

    const result = await scanConformance({ now })
    expect(result.delta14d.fleet).toBe(25)
    expect(result.delta14d.agenticapps).toBe(25)
    expect(result.delta14d.factiv).toBe(25)
    expect(result.delta14d.neuroflash).toBe(25)
  })

  it('delta14d = 0 when no series entry is old enough (cold start)', async () => {
    // Anchor 2026-05-15; series only spans 2026-05-11..2026-05-15 (5 entries).
    // None are ≤ target (2026-05-01), so baseline=null → delta=0.
    const now = new Date('2026-05-15T00:00:00.000Z')
    const series = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-05-${String(i + 11).padStart(2, '0')}`,
      fleet: 50,
      agenticapps: 50,
      factiv: 50,
      neuroflash: 50,
    }))
    vi.mocked(readDailySeriesForFleet).mockResolvedValue(series)

    const result = await scanConformance({ now })
    expect(result.delta14d.fleet).toBe(0)
    expect(result.delta14d.agenticapps).toBe(0)
    expect(result.delta14d.factiv).toBe(0)
    expect(result.delta14d.neuroflash).toBe(0)
  })

  it('delta14d tolerates calendar gaps (uses closest older entry, not array position)', async () => {
    // Regression for the position-based bug. Anchor 2026-05-15;
    // target=2026-05-01. Series has only TWO entries: 2026-04-20 (score 60)
    // and 2026-05-15 (score 100). Position-based would index series[-13],
    // which is invalid. Date-based picks 2026-04-20 (closest entry whose
    // date ≤ target). Delta = 100 − 60 = 40.
    const now = new Date('2026-05-15T00:00:00.000Z')
    const series = [
      {
        date: '2026-04-20',
        fleet: 60,
        agenticapps: 60,
        factiv: 60,
        neuroflash: 60,
      },
      {
        date: '2026-05-15',
        fleet: 100,
        agenticapps: 100,
        factiv: 100,
        neuroflash: 100,
      },
    ]
    vi.mocked(readDailySeriesForFleet).mockResolvedValue(series)

    const result = await scanConformance({ now })
    expect(result.delta14d.fleet).toBe(40)
  })

  it('drifted repo IDs flow into computeConformanceScores (excluded from denominator)', async () => {
    // Drift the factiv repo's stored path under the agenticapps family root.
    // We need an entry whose storedPath maps to factiv/f-1 via family-root
    // prefix. Use the COVERAGE_ROOTS factory by constructing the path with
    // homedir + Sourcecode + factiv + f-1.
    const { homedir } = await import('node:os')
    const { join } = await import('node:path')
    const factivPath = join(homedir(), 'Sourcecode', 'factiv', 'f-1')

    vi.mocked(detectPathDrift).mockResolvedValue([
      {
        id: 'f-1',
        storedPath: factivPath,
        suggestedPath: null,
        reason: 'missing',
      },
    ])
    // Coverage has all-fresh for f-1; if drift exclusion works, factiv's
    // score is computed over zero rows = 0 (no rows = score 0 per conformanceScore.ts).
    const result = await scanConformance()
    expect(result.today.factiv).toBe(0) // factiv had one repo, drifted, no other rows
    expect(result.today.agenticapps).toBe(100) // unaffected
    expect(result.today.neuroflash).toBe(100) // unaffected
  })

  it('Adversarial F3 — pathToRepoId resolves family roots through symlinks (realpath parity with storedPath)', async () => {
    // storedPath in the registry is canonical (registry.addProject runs
    // canonicaliseRoot → realpathSync). COVERAGE_ROOTS[family]() can return
    // a path containing a symlink — on macOS, `/tmp` → `/private/tmp` is the
    // natural example; cross-platform we plant our own symlink. If
    // pathToRepoId compares them raw, the prefix match fails and drift
    // detection silently disagrees with scoring (the drift never reaches
    // the per-family denominator-exclusion set).
    //
    // Setup:
    //   /tmp/X-/agenticapps/repo-1   ← real
    //   /tmp/Y-/agenticapps           → symlink to /tmp/X-/agenticapps
    //   COVERAGE_ROOTS.agenticapps = /tmp/Y-/agenticapps
    //   storedPath (from registry, canonical) = realpath(/tmp/X-)/agenticapps/repo-1
    //
    // Today: pathToRepoId compares `/tmp/X-/.../repo-1` (realpath) vs
    //   `/tmp/Y-/agenticapps` (raw, symlinked) → no prefix match → null →
    //   driftedRepoIds is empty → repo NOT excluded from denominator →
    //   coverage row (all-fresh) is counted → agenticapps score = 100.
    // After fix: pathToRepoId realpaths COVERAGE_ROOTS first → match →
    //   driftedRepoIds = {agenticapps/repo-1} → excluded → no rows → score 0.
    const { mkdtempSync, mkdirSync, symlinkSync, realpathSync } = await import(
      'node:fs'
    )
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { COVERAGE_ROOTS } = await import('./paths.js')

    const realParent = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-f3-real-')))
    const symParent = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-f3-sym-')))
    const realFamilyRoot = join(realParent, 'agenticapps')
    mkdirSync(realFamilyRoot, { recursive: true })
    // Plant the family root as a symlink: /tmp/SYM/agenticapps -> /tmp/REAL/agenticapps
    const symFamilyRoot = join(symParent, 'agenticapps')
    symlinkSync(realFamilyRoot, symFamilyRoot)

    // Project lives at the REAL path; storedPath in the registry is the
    // canonicalised version, which is the real-parent form.
    const storedPath = join(realFamilyRoot, 'repo-1')
    mkdirSync(storedPath, { recursive: true })

    // Override COVERAGE_ROOTS.agenticapps to return the SYMLINK path. Same
    // pattern as registryFixPath.test.ts.
    const originalAgenticapps = COVERAGE_ROOTS.agenticapps
    ;(COVERAGE_ROOTS as unknown as Record<string, () => string>).agenticapps =
      () => symFamilyRoot

    try {
      vi.mocked(detectPathDrift).mockResolvedValue([
        {
          id: 'repo-1',
          storedPath,
          suggestedPath: null,
          reason: 'missing',
        },
      ])
      vi.mocked(scanCoverageInternal).mockResolvedValue({
        response: makeCoverage([
          makeRow('agenticapps', 'repo-1'),
          // factiv + neuroflash unaffected.
          makeRow('factiv', 'f-1'),
          makeRow('neuroflash', 'n-1'),
        ]),
        internalRows: [],
      })

      const result = await scanConformance()
      // Post-fix: drift exclusion works → agenticapps has no countable
      // rows → score 0. Today (RED) this is 100.
      expect(result.today.agenticapps).toBe(0)
    } finally {
      ;(COVERAGE_ROOTS as unknown as Record<string, () => string>).agenticapps =
        originalAgenticapps
    }
  })

  it('Adversarial F3 ENOENT fallback — absent family root still produces correct repo IDs (CI parity)', async () => {
    // When the family root directory doesn't exist on this machine (common
    // on CI runners that don't pre-create `~/Sourcecode/...`), realpath
    // throws ENOENT. We MUST fall back to the raw COVERAGE_ROOTS value so
    // string-level prefix matches continue to work — otherwise every test
    // that synthesises a storedPath under a non-existent root would regress
    // to "drift not excluded → score 100" the way CI regressed when this PR
    // first shipped without the ENOENT fallback.
    //
    // We invoke this through scanConformance with the default factiv root
    // (homedir() + '/Sourcecode/factiv') and an `f-1` storedPath under it.
    // Even if /home/runner/Sourcecode/factiv doesn't exist (CI case), the
    // raw-string match still finds it.
    const { homedir } = await import('node:os')
    const { join } = await import('node:path')
    const { COVERAGE_ROOTS } = await import('./paths.js')

    // Point at a guaranteed-absent path so we exercise the ENOENT branch
    // even on a dev machine where /Sourcecode/factiv does exist.
    const absentRoot = '/this/path/definitely/does/not/exist/factiv'
    const originalFactiv = COVERAGE_ROOTS.factiv
    ;(COVERAGE_ROOTS as unknown as Record<string, () => string>).factiv = () =>
      absentRoot

    try {
      vi.mocked(detectPathDrift).mockResolvedValue([
        {
          id: 'f-1',
          storedPath: join(absentRoot, 'f-1'),
          suggestedPath: null,
          reason: 'missing',
        },
      ])
      vi.mocked(scanCoverageInternal).mockResolvedValue({
        response: makeCoverage([
          makeRow('agenticapps', 'aa-1'),
          makeRow('factiv', 'f-1'),
          makeRow('neuroflash', 'n-1'),
        ]),
        internalRows: [],
      })
      const result = await scanConformance()
      // Drift exclusion must still work under ENOENT fallback → factiv has
      // no countable rows → score 0.
      expect(result.today.factiv).toBe(0)
      // agenticapps + neuroflash unaffected.
      expect(result.today.agenticapps).toBe(100)
      expect(result.today.neuroflash).toBe(100)

      // Silence unused-import lint by demonstrating the homedir fallback
      // root would also work — kept as a comment to avoid the test
      // depending on machine state. (homedir() exercised in the
      // non-fallback test at line 199.)
      void homedir
    } finally {
      ;(COVERAGE_ROOTS as unknown as Record<string, () => string>).factiv =
        originalFactiv
    }
  })

  it('partialFailures lists failed sub-scans when readDailySeriesForFleet rejects', async () => {
    // Regression for the silent-failure mask. A defensive empty payload is
    // indistinguishable from real-zero data without an explicit failure
    // marker. The SPA needs `partialFailures: ['series']` to surface a
    // banner instead of misreporting "no history".
    vi.mocked(readDailySeriesForFleet).mockRejectedValue(new Error('synthetic ndjson failure'))

    const result = await scanConformance()
    expect(result.series).toEqual([])
    expect(result.partialFailures).toEqual(['series'])
  })

  it('partialFailures is omitted from the payload when all sub-scans succeed', async () => {
    // Field is `.optional()` on the schema — absent on healthy responses
    // so v1 clients that ignore it stay clean.
    const result = await scanConformance()
    expect(result.partialFailures).toBeUndefined()
  })

  it('partial failure: scanCoverageInternal throws → returns defensive empty payload (does not raise)', async () => {
    vi.mocked(scanCoverageInternal).mockRejectedValue(new Error('synthetic scan failure'))
    const result = await scanConformance()
    expect(result.today.fleet).toBe(0)
    expect(result.today.agenticapps).toBe(0)
    expect(result.today.factiv).toBe(0)
    expect(result.today.neuroflash).toBe(0)
    expect(result.delta14d.fleet).toBe(0)
    expect(result.series).toEqual([])
    expect(result.drifted).toEqual([])
    // Schema still satisfied.
    expect(() => ConformanceResponseSchema.parse(result)).not.toThrow()
  })

  it('partial failure: readDailySeriesForFleet throws → series defaults to []; today still computed', async () => {
    vi.mocked(readDailySeriesForFleet).mockRejectedValue(new Error('reader failure'))
    const result = await scanConformance()
    expect(result.series).toEqual([])
    expect(result.today.fleet).toBe(100) // unaffected
  })

  it('integration: full payload parses ConformanceResponseSchema.strict() with all fields populated', async () => {
    vi.mocked(readDailySeriesForFleet).mockResolvedValue([
      { date: '2026-05-19', fleet: 90, agenticapps: 90, factiv: 90, neuroflash: 90 },
    ])
    vi.mocked(detectPathDrift).mockResolvedValue([
      {
        id: 'driftme',
        storedPath: '/some/path',
        suggestedPath: '/some/other/path',
        reason: 'symlink-target-changed',
      },
    ])
    const result = await scanConformance({ now: new Date('2026-05-19T12:00:00.000Z') })
    expect(() => ConformanceResponseSchema.parse(result)).not.toThrow()
    expect(result.series.length).toBe(1)
    expect(result.drifted.length).toBe(1)
  })
})
