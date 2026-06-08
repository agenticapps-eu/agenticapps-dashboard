/**
 * installUnderstandViewer.test.ts — TDD tests for runInstallUnderstandViewer (Plan 14-07).
 *
 * All 7 behavior tests per plan specification:
 *   1. Missing plugin cache → exact error message + exit 1
 *   2. Empty cache (no semver dirs) → exact message + exit 1
 *   3. pnpm probe failure → exact message + exit 1
 *   4. Core dist absent → core build invoked (pnpm install if node_modules absent, then pnpm build)
 *      Core dist present → core build skipped
 *   5. Dashboard build invoked with vite build + --base=./ args; non-zero exit → error + exit 1
 *   6. Post-build base verification: /assets/ in index.html → fail; ./assets/ → proceed
 *   7. Happy path: copies dist/ to UNDERSTAND_VIEWER_DIR/<version>/ + prints target + restart hint
 *
 * Seam: _seams.exec(cmd, args, opts?) mirrors execFile argv-array style (T-14-07-03).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── Seam injection ────────────────────────────────────────────────────────────
// We use a seam pattern where the module exports a _seams object that can be
// overridden in tests. This matches the convention installLaunchd.test.ts uses
// for side effects.

import {
  runInstallUnderstandViewer,
  type InstallUnderstandViewerSeams,
  _seams,
} from './installUnderstandViewer.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'install-viewer-test-'))
}

/**
 * Build a minimal fake plugin cache dir with a single semver version.
 * Returns { cacheDir, versionDir, coreDir, dashboardDir, dashboardDistDir }.
 */
function makeFakeCache(root: string, version = '2.7.6') {
  const cacheDir = join(root, 'understand-anything', 'understand-anything')
  const versionDir = join(cacheDir, version)
  const coreDir = join(versionDir, 'packages', 'core')
  const dashboardDir = join(versionDir, 'packages', 'dashboard')
  const dashboardDistDir = join(dashboardDir, 'dist')
  mkdirSync(coreDir, { recursive: true })
  mkdirSync(dashboardDir, { recursive: true })
  return { cacheDir, versionDir, coreDir, dashboardDir, dashboardDistDir }
}

describe('runInstallUnderstandViewer', () => {
  let tmpRoot: string
  let targetDir: string
  let originalSeams: InstallUnderstandViewerSeams

  beforeEach(() => {
    tmpRoot = makeTmpDir()
    targetDir = join(tmpRoot, 'understand-viewer')
    mkdirSync(targetDir, { recursive: true })

    // Save original seams for restoration
    originalSeams = { ..._seams }
  })

  afterEach(() => {
    // Restore seams
    Object.assign(_seams, originalSeams)
    rmSync(tmpRoot, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  // ── Test 1: Missing plugin cache ─────────────────────────────────────────────

  it('Test 1: missing plugin cache dir → exact error message + exit 1', async () => {
    const missingCache = join(tmpRoot, 'nonexistent', 'cache')

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const execSpy = vi.fn()

    _seams.exec = execSpy
    _seams.cacheDir = missingCache
    _seams.viewerDir = targetDir

    await expect(runInstallUnderstandViewer()).rejects.toThrow('process.exit called')

    expect(errorSpy).toHaveBeenCalledWith(
      'understand-anything plugin not found. Install with: claude /plugins install understand-anything',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(execSpy).not.toHaveBeenCalled()
  })

  // ── Test 2: Empty cache (no semver dirs) ─────────────────────────────────────

  it('Test 2: cache exists but no semver dirs → exact message + exit 1', async () => {
    const emptyCache = join(tmpRoot, 'empty-cache')
    mkdirSync(emptyCache, { recursive: true })
    // No semver subdirs

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const execSpy = vi.fn()

    _seams.exec = execSpy
    _seams.cacheDir = emptyCache
    _seams.viewerDir = targetDir

    await expect(runInstallUnderstandViewer()).rejects.toThrow('process.exit called')

    expect(errorSpy).toHaveBeenCalledWith(
      'No understand-anything version found in plugin cache',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(execSpy).not.toHaveBeenCalled()
  })

  // ── Test 3: pnpm probe failure ────────────────────────────────────────────────

  it('Test 3: pnpm probe failure → exact message + exit 1', async () => {
    const { cacheDir } = makeFakeCache(tmpRoot)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // exec spy: first call (pnpm ['--version']) throws → pnpm missing
    const execSpy = vi.fn().mockRejectedValue(new Error('pnpm not found'))

    _seams.exec = execSpy
    _seams.cacheDir = cacheDir
    _seams.viewerDir = targetDir

    await expect(runInstallUnderstandViewer()).rejects.toThrow('process.exit called')

    expect(errorSpy).toHaveBeenCalledWith(
      'pnpm is required to build the viewer. Install: npm install -g pnpm',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
    // Only the pnpm probe call should have happened
    expect(execSpy).toHaveBeenCalledTimes(1)
    // First arg is 'pnpm', second is ['--version'] array
    expect(execSpy.mock.calls[0]![0]).toBe('pnpm')
    expect(execSpy.mock.calls[0]![1]).toContain('--version')
  })

  // ── Test 4a: Core dist absent → core build invoked ───────────────────────────

  it('Test 4a: core dist absent + node_modules absent → pnpm install then pnpm build in core', async () => {
    const { cacheDir, coreDir, dashboardDir, dashboardDistDir } = makeFakeCache(tmpRoot)
    // core/dist NOT present, core/node_modules NOT present
    // Create fake dashboard dist with relative assets
    mkdirSync(dashboardDistDir, { recursive: true })
    writeFileSync(join(dashboardDistDir, 'index.html'), '<script src="./assets/index.js"></script>')

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Track calls as { cmd, args, cwd }
    const execCalls: Array<{ cmd: string; args: string[]; cwd: string | undefined }> = []
    const execSpy = vi.fn().mockImplementation((cmd: string, args: string[], opts?: { cwd?: string }) => {
      execCalls.push({ cmd, args, cwd: opts?.cwd })
      return Promise.resolve({ stdout: '', stderr: '' })
    })
    const cpSyncSpy = vi.fn()

    _seams.exec = execSpy
    _seams.cpSync = cpSyncSpy
    _seams.rmSync = vi.fn()
    _seams.renameSync = vi.fn()
    _seams.cacheDir = cacheDir
    _seams.viewerDir = targetDir

    // Should succeed (no exit 1)
    await runInstallUnderstandViewer()

    // pnpm --version probe
    expect(execCalls[0]!.cmd).toBe('pnpm')
    expect(execCalls[0]!.args).toContain('--version')

    // pnpm install in core (because node_modules absent)
    const coreInstallCall = execCalls.find(
      (c) => c.cwd === coreDir && c.args.includes('install'),
    )
    expect(coreInstallCall).toBeDefined()
    // Supply-chain hardening (CSO item 5): the install must NOT run lifecycle
    // scripts from the plugin's transitive dependencies.
    expect(coreInstallCall!.args).toContain('--ignore-scripts')

    // pnpm build in core
    const coreBuildCall = execCalls.find(
      (c) => c.cwd === coreDir && c.args.includes('build') && !c.args.includes('install'),
    )
    expect(coreBuildCall).toBeDefined()

    // pnpm vite build --base=./ in dashboard
    const dashBuildCall = execCalls.find(
      (c) => c.cwd === dashboardDir && c.args.includes('vite') && c.args.includes('build'),
    )
    expect(dashBuildCall).toBeDefined()
    expect(dashBuildCall!.args).toContain('--base=./')

    // Verify order: core install before core build before dashboard build
    const coreInstallIdx = execCalls.indexOf(coreInstallCall!)
    const coreBuildIdx = execCalls.indexOf(coreBuildCall!)
    const dashBuildIdx = execCalls.indexOf(dashBuildCall!)
    expect(coreInstallIdx).toBeLessThan(coreBuildIdx)
    expect(coreBuildIdx).toBeLessThan(dashBuildIdx)

    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('Test 4b: core dist present → core build skipped', async () => {
    const { cacheDir, coreDir, dashboardDir, dashboardDistDir } = makeFakeCache(tmpRoot)
    // Create core/dist/schema.js to simulate already-built core
    const coreDistDir = join(coreDir, 'dist')
    mkdirSync(coreDistDir, { recursive: true })
    writeFileSync(join(coreDistDir, 'schema.js'), 'export const schema = {}')
    // Create fake dashboard dist with relative assets
    mkdirSync(dashboardDistDir, { recursive: true })
    writeFileSync(join(dashboardDistDir, 'index.html'), '<script src="./assets/index.js"></script>')

    vi.spyOn(console, 'log').mockImplementation(() => {})

    const execCalls: Array<{ cmd: string; args: string[]; cwd: string | undefined }> = []
    const execSpy = vi.fn().mockImplementation((cmd: string, args: string[], opts?: { cwd?: string }) => {
      execCalls.push({ cmd, args, cwd: opts?.cwd })
      return Promise.resolve({ stdout: '', stderr: '' })
    })
    const cpSyncSpy = vi.fn()

    _seams.exec = execSpy
    _seams.cpSync = cpSyncSpy
    _seams.rmSync = vi.fn()
    _seams.renameSync = vi.fn()
    _seams.cacheDir = cacheDir
    _seams.viewerDir = targetDir

    await runInstallUnderstandViewer()

    // Should NOT have called pnpm in core at all
    const coreExecCalls = execCalls.filter((c) => c.cwd === coreDir)
    expect(coreExecCalls).toHaveLength(0)
    // Should still call dashboard build
    const dashBuildCall = execCalls.find((c) => c.cwd === dashboardDir && c.args.includes('vite'))
    expect(dashBuildCall).toBeDefined()
  })

  // ── Test 5: Dashboard build failure ──────────────────────────────────────────

  it('Test 5: dashboard build non-zero exit → viewer-build error + exit 1', async () => {
    const { cacheDir, dashboardDir } = makeFakeCache(tmpRoot)
    // core dist present to skip core build
    const coreDistDir = join(
      cacheDir,
      '2.7.6',
      'packages',
      'core',
      'dist',
    )
    mkdirSync(coreDistDir, { recursive: true })
    writeFileSync(join(coreDistDir, 'schema.js'), '')

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const execSpy = vi.fn().mockImplementation((cmd: string, args: string[], opts?: { cwd?: string }) => {
      if (opts?.cwd === dashboardDir) {
        return Promise.reject(new Error('Build failed: exit code 1'))
      }
      return Promise.resolve({ stdout: '', stderr: '' })
    })

    _seams.exec = execSpy
    _seams.cacheDir = cacheDir
    _seams.viewerDir = targetDir

    await expect(runInstallUnderstandViewer()).rejects.toThrow('process.exit called')

    const errorArgs = errorSpy.mock.calls.flat().join('\n')
    expect(errorArgs).toContain('Failed to build understand-anything viewer')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  // ── Test 6: Post-build base verification ─────────────────────────────────────

  it('Test 6a: dist/index.html has root-absolute /assets/ refs → fail with --base=./ message', async () => {
    const { cacheDir, dashboardDistDir } = makeFakeCache(tmpRoot)
    // core dist present
    const coreDistDir = join(cacheDir, '2.7.6', 'packages', 'core', 'dist')
    mkdirSync(coreDistDir, { recursive: true })
    writeFileSync(join(coreDistDir, 'schema.js'), '')
    // dashboard dist has root-absolute refs (the bad case — base=./ was ignored)
    mkdirSync(dashboardDistDir, { recursive: true })
    writeFileSync(
      join(dashboardDistDir, 'index.html'),
      '<script type="module" crossorigin src="/assets/index-abc.js"></script>',
    )

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const execSpy = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })

    _seams.exec = execSpy
    _seams.cacheDir = cacheDir
    _seams.viewerDir = targetDir

    await expect(runInstallUnderstandViewer()).rejects.toThrow('process.exit called')

    const errorArgs = errorSpy.mock.calls.flat().join('\n')
    expect(errorArgs).toContain('--base=./')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('Test 6b: dist/index.html has relative ./assets/ refs → proceeds successfully', async () => {
    const { cacheDir, dashboardDistDir } = makeFakeCache(tmpRoot)
    // core dist present
    const coreDistDir = join(cacheDir, '2.7.6', 'packages', 'core', 'dist')
    mkdirSync(coreDistDir, { recursive: true })
    writeFileSync(join(coreDistDir, 'schema.js'), '')
    // dashboard dist has relative refs (the good case)
    mkdirSync(dashboardDistDir, { recursive: true })
    writeFileSync(
      join(dashboardDistDir, 'index.html'),
      '<script type="module" crossorigin src="./assets/index-abc.js"></script>',
    )

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const execSpy = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
    const cpSyncSpy = vi.fn()

    _seams.exec = execSpy
    _seams.cpSync = cpSyncSpy
    _seams.rmSync = vi.fn()
    _seams.renameSync = vi.fn()
    _seams.cacheDir = cacheDir
    _seams.viewerDir = targetDir

    await runInstallUnderstandViewer()

    expect(exitSpy).not.toHaveBeenCalled()
    // cpSync was invoked (copy happened)
    expect(cpSyncSpy).toHaveBeenCalled()
  })

  // ── Test 7: Happy path (atomic install) ──────────────────────────────────────

  it('Test 7: happy path stages dist/ in a temp sibling, then renames atomically to <version>/ + prints target + restart hint', async () => {
    const { cacheDir, dashboardDistDir } = makeFakeCache(tmpRoot)
    // core dist present
    const coreDistDir = join(cacheDir, '2.7.6', 'packages', 'core', 'dist')
    mkdirSync(coreDistDir, { recursive: true })
    writeFileSync(join(coreDistDir, 'schema.js'), '')
    // dashboard dist with relative refs + nested assets
    const assetsDir = join(dashboardDistDir, 'assets')
    mkdirSync(assetsDir, { recursive: true })
    writeFileSync(join(dashboardDistDir, 'index.html'), '<script src="./assets/index.js"></script>')
    writeFileSync(join(assetsDir, 'index.js'), 'console.log("viewer")')

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const execSpy = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })

    // Track cpSync calls to verify source → destination
    const cpSyncCalls: Array<{ src: string; dst: string }> = []
    const cpSyncSpy = vi.fn().mockImplementation((src: string, dst: string) => {
      cpSyncCalls.push({ src, dst })
    })
    const renameCalls: Array<{ from: string; to: string }> = []
    const renameSpy = vi.fn().mockImplementation((from: string, to: string) => {
      renameCalls.push({ from, to })
    })
    const rmSpy = vi.fn()

    _seams.exec = execSpy
    _seams.cpSync = cpSyncSpy
    _seams.rmSync = rmSpy
    _seams.renameSync = renameSpy
    _seams.cacheDir = cacheDir
    _seams.viewerDir = targetDir

    await runInstallUnderstandViewer()

    // No exit
    expect(exitSpy).not.toHaveBeenCalled()

    const finalTarget = join(targetDir, '2.7.6')

    // cpSync stages into a temp sibling under the SAME parent (viewerDir) —
    // NEVER directly into the final target (atomicity).
    expect(cpSyncCalls).toHaveLength(1)
    expect(cpSyncCalls[0]!.src).toBe(join(cacheDir, '2.7.6', 'packages', 'dashboard', 'dist'))
    expect(cpSyncCalls[0]!.dst).not.toBe(finalTarget)
    expect(cpSyncCalls[0]!.dst.startsWith(targetDir)).toBe(true)

    // renameSync swaps temp → final target as the last step
    expect(renameCalls).toHaveLength(1)
    expect(renameCalls[0]!.from).toBe(cpSyncCalls[0]!.dst)
    expect(renameCalls[0]!.to).toBe(finalTarget)

    // The existing target is removed before the rename
    const rmTargets = rmSpy.mock.calls.map((c) => c[0] as string)
    expect(rmTargets).toContain(finalTarget)

    // Logged target path and restart hint
    const logged = logSpy.mock.calls.flat().join('\n')
    expect(logged).toContain(finalTarget)
    expect(logged).toMatch(/restart/i)
  })

  // ── Test 8: Missing dist/index.html after build → FATAL ──────────────────────

  it('Test 8: missing dist/index.html after the vite build → exact message + exit 1, no install', async () => {
    const { cacheDir, dashboardDistDir } = makeFakeCache(tmpRoot)
    // core dist present
    const coreDistDir = join(cacheDir, '2.7.6', 'packages', 'core', 'dist')
    mkdirSync(coreDistDir, { recursive: true })
    writeFileSync(join(coreDistDir, 'schema.js'), '')
    // dashboard dist exists but has NO index.html (broken build output)
    mkdirSync(dashboardDistDir, { recursive: true })

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const execSpy = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
    const cpSyncSpy = vi.fn()
    const renameSpy = vi.fn()

    _seams.exec = execSpy
    _seams.cpSync = cpSyncSpy
    _seams.rmSync = vi.fn()
    _seams.renameSync = renameSpy
    _seams.cacheDir = cacheDir
    _seams.viewerDir = targetDir

    await expect(runInstallUnderstandViewer()).rejects.toThrow('process.exit called')

    expect(errorSpy).toHaveBeenCalledWith(
      'Viewer build did not produce dist/index.html — refusing to install a broken viewer',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
    // A broken build must never be installed
    expect(cpSyncSpy).not.toHaveBeenCalled()
    expect(renameSpy).not.toHaveBeenCalled()
  })
})
