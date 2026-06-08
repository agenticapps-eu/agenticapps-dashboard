/**
 * installUnderstandViewer.ts — `agentic-dashboard install-understand-viewer` (Plan 14-07, D-14-01).
 *
 * Build sequence (from 14-RESEARCH.md Critical Q2, verified against live cache v2.7.6):
 *   1. Locate UNDERSTAND_PLUGIN_CACHE → newest semver version dir (via viewerInstall helpers).
 *   2. Check `pnpm` on PATH.
 *   3. Ensure packages/core/dist/schema.js exists; else pnpm install (if node_modules absent)
 *      then pnpm build in packages/core.
 *   4. pnpm vite build --base=./ in packages/dashboard (relative base is MANDATORY — Pitfall 7).
 *      A1 guard: dist/index.html MUST exist (missing entry point = fatal) and must
 *      reference ./assets/ (relative), not /assets/ (absolute).
 *   5. Atomic install: stage dist/ in a temp sibling under UNDERSTAND_VIEWER_DIR,
 *      then rm the old <version>/ and rename staging → <version>/ (write boundary;
 *      the daemon never serves a half-copied tree).
 *   6. Print success + restart hint.
 *
 * Security (T-14-07-02, T-14-07-03):
 *   - Target path: UNDERSTAND_VIEWER_DIR constant + semver version (regex-validated by viewerInstall).
 *   - All exec calls use fixed argv arrays — no shell involved, no user input interpolation.
 *   - pnpm install only runs inside the plugin's own cached workspace against its lockfile.
 */
import { existsSync, readFileSync, mkdirSync, cpSync, rmSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'

import { getNewestPluginCacheVersion } from '../lib/viewerInstall.js'
import {
  UNDERSTAND_PLUGIN_CACHE,
  UNDERSTAND_VIEWER_DIR,
} from '../constants.js'

const execFileAsync = promisify(execFileCb)

// ── Error messages (byte-exact per failure-mode table from 14-07-PLAN.md) ────

const MSG_NO_CACHE =
  'understand-anything plugin not found. Install with: claude /plugins install understand-anything'
const MSG_NO_VERSION = 'No understand-anything version found in plugin cache'
const MSG_NO_PNPM = 'pnpm is required to build the viewer. Install: npm install -g pnpm'
const MSG_CORE_BUILD_FAILED = 'Failed to build @understand-anything/core'
const MSG_DASHBOARD_BUILD_FAILED = 'Failed to build understand-anything viewer'
const MSG_NO_INDEX_HTML =
  'Viewer build did not produce dist/index.html — refusing to install a broken viewer'
const MSG_COPY_FAILED = 'Failed to install viewer to ~/.agenticapps/dashboard/understand-viewer/'

// ── Seams (injectable for tests — mirrors installLaunchd convention) ──────────
//
// The exec seam accepts (cmd, args, opts) — argv-array style matching execFile.
// Tests inject a vi.fn() that ignores the argv structure and controls outcomes.

export type ExecFn = (
  cmd: string,
  args: string[],
  opts?: { cwd?: string },
) => Promise<{ stdout: string; stderr: string }>

export type CpSyncFn = (src: string, dst: string, opts?: { recursive: boolean }) => void

export type RmSyncFn = (path: string, opts?: { recursive: boolean; force: boolean }) => void

export type RenameSyncFn = (oldPath: string, newPath: string) => void

export interface InstallUnderstandViewerSeams {
  exec: ExecFn
  cpSync: CpSyncFn
  rmSync: RmSyncFn
  renameSync: RenameSyncFn
  cacheDir: string
  viewerDir: string
}

export const _seams: InstallUnderstandViewerSeams = {
  exec: execFileAsync as ExecFn,
  cpSync: (src, dst, opts) => cpSync(src, dst, opts ?? { recursive: true }),
  rmSync: (path, opts) => rmSync(path, opts ?? { recursive: true, force: true }),
  renameSync: (oldPath, newPath) => renameSync(oldPath, newPath),
  cacheDir: UNDERSTAND_PLUGIN_CACHE,
  viewerDir: UNDERSTAND_VIEWER_DIR,
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Die with an error message and exit 1. Throws in tests (process.exit mocked).
 */
function fatal(msg: string, detail?: string): never {
  console.error(msg)
  if (detail) console.error(detail)
  process.exit(1)
  // Unreachable in production; TypeScript needs this for the `never` return type.
  throw new Error(msg)
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runInstallUnderstandViewer(): Promise<void> {
  const {
    exec,
    cpSync: cpSyncFn,
    rmSync: rmSyncFn,
    renameSync: renameSyncFn,
    cacheDir,
    viewerDir,
  } = _seams

  // Step 1: Locate plugin cache + newest version
  if (!existsSync(cacheDir)) {
    fatal(MSG_NO_CACHE)
  }

  const version = getNewestPluginCacheVersion(cacheDir)
  if (!version) {
    fatal(MSG_NO_VERSION)
  }

  const versionDir = join(cacheDir, version)
  const coreDir = join(versionDir, 'packages', 'core')
  const dashboardDir = join(versionDir, 'packages', 'dashboard')
  const dashboardDistDir = join(dashboardDir, 'dist')
  const coreDistSchema = join(coreDir, 'dist', 'schema.js')
  const coreNodeModules = join(coreDir, 'node_modules')

  // Step 2: Check pnpm — argv array, no shell (T-14-07-03)
  try {
    await exec('pnpm', ['--version'])
  } catch {
    fatal(MSG_NO_PNPM)
  }

  // Step 3: Build @understand-anything/core if dist/schema.js absent
  if (!existsSync(coreDistSchema)) {
    // If node_modules absent in core workspace, install first (RESEARCH assumption A5 mitigation)
    if (!existsSync(coreNodeModules)) {
      try {
        // --ignore-scripts (CSO item 5, supply-chain): never run lifecycle
        // scripts from the plugin's transitive dependencies during install.
        await exec('pnpm', ['install', '--ignore-scripts'], { cwd: coreDir })
      } catch (err) {
        fatal(MSG_CORE_BUILD_FAILED, String(err))
      }
    }
    try {
      await exec('pnpm', ['build'], { cwd: coreDir })
    } catch (err) {
      fatal(MSG_CORE_BUILD_FAILED, String(err))
    }
  }

  // Step 4: Build the dashboard with --base=./ (relative base — MANDATORY, Pitfall 7)
  // argv array: no shell interpolation; --base=./ is a literal flag (T-14-07-03)
  try {
    await exec('pnpm', ['vite', 'build', '--base=./'], { cwd: dashboardDir })
  } catch (err) {
    fatal(MSG_DASHBOARD_BUILD_FAILED, String(err))
  }

  // A1 guard precondition: the build MUST produce dist/index.html. A missing
  // entry point means a broken build — installing it would leave the daemon
  // serving 404s while the CLI reports success.
  const indexHtmlPath = join(dashboardDistDir, 'index.html')
  if (!existsSync(indexHtmlPath)) {
    fatal(MSG_NO_INDEX_HTML)
  }

  // A1 guard: assert dist/index.html does NOT reference root-absolute /assets/
  // Regex checks for src="/assets/ or href="/assets/ patterns (root-absolute).
  // Relative ./assets/ and ../assets/ are acceptable; only bare /assets/ indicates broken base.
  const indexHtml = readFileSync(indexHtmlPath, 'utf8')
  if (/(?:src|href)=["']\/assets\//.test(indexHtml)) {
    fatal(
      'Build output uses root-absolute asset paths (/assets/). ' +
        'The --base=./ flag was not honoured by Vite. ' +
        'Check the Vite version and that "build.base" is not overriding --base=./ in vite.config.',
    )
  }

  // Step 5: Atomic install — stage dist/ in a temp sibling under viewerDir,
  // then rmSync the existing target (if any) and renameSync temp → target.
  // The daemon never observes a half-copied tree: it either sees the previous
  // install or the complete new one (rename within the same parent dir).
  const targetDir = join(viewerDir, version)
  const stagingDir = join(viewerDir, `.${version}.staging-${process.pid}`)
  try {
    mkdirSync(viewerDir, { recursive: true })
    rmSyncFn(stagingDir, { recursive: true, force: true })
    cpSyncFn(dashboardDistDir, stagingDir, { recursive: true })
    rmSyncFn(targetDir, { recursive: true, force: true })
    renameSyncFn(stagingDir, targetDir)
  } catch (err) {
    // Best-effort staging cleanup; never mask the original failure.
    try {
      rmSyncFn(stagingDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
    fatal(MSG_COPY_FAILED, String(err))
  }

  // Step 6: Success
  console.log(`understand-anything viewer v${version} installed -> ${targetDir}`)
  console.log('')
  console.log('To use the new viewer, restart the daemon:')
  console.log('  agentic-dashboard stop && agentic-dashboard start')
}
