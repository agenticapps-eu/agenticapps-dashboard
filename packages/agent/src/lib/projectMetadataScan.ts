/**
 * projectMetadataScan.ts — daemon-side scanners for top-level project metadata.
 *
 * Each function reads through resolveAllowedNamed (D-5-13) to enforce root +
 * basename/extension allow-list. NEVER reads .env content for DSN values —
 * only substring-matches the literal SENTRY_DSN key (T-5-NoSecretRead).
 *
 * Exports (9 functions covering HEALTH-03 + HEALTH-04 + HEALTH-05 vocabulary):
 *  - parsePackageJsonForSentry
 *  - parsePackageJsonForSpotlight
 *  - parsePackageJsonForSentryCli
 *  - parseSentryClirc
 *  - detectSpotlightDir
 *  - detectSentryDsnEnv
 *  - detectSentryCliBinary
 *  - parseCiWorkflowsForSentry
 *  - parseInfisicalConfig
 */
import { join } from 'node:path'
import { readFile, readdir, stat, existsSync, statSync } from 'node:fs'
import { promisify } from 'node:util'

import { execa } from 'execa'
import type { ObservabilitySignal, SecretsResponse } from '@agenticapps/dashboard-shared'

import { resolveAllowedNamed } from './paths.js'

const readFileAsync = promisify(readFile)
const readdirAsync = promisify(readdir)

const SENTRY_CLI_BINARY_TIMEOUT_MS = 5_000

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Safely read and JSON.parse a file. Returns null on any failure. */
async function readJsonFile(absPath: string): Promise<unknown | null> {
  try {
    const raw = await readFileAsync(absPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ─── 1. parsePackageJsonForSentry ────────────────────────────────────────────

/**
 * Read package.json and emit ObservabilitySignals for:
 *  - deps/devDeps matching ^@sentry/ → signal 'sentry-sdk-dep'
 *  - scripts containing substring 'sentry-cli' → signal 'sentry-cli-script'
 */
export async function parsePackageJsonForSentry(projectRoot: string): Promise<ObservabilitySignal[]> {
  const signals: ObservabilitySignal[] = []
  const candidate = join(projectRoot, 'package.json')
  let real: string
  try {
    real = await resolveAllowedNamed(candidate, { roots: [projectRoot], allowedNames: ['package.json'] })
  } catch {
    return []
  }
  const pkg = await readJsonFile(real)
  if (!pkg || typeof pkg !== 'object') return []
  const pkgObj = pkg as Record<string, unknown>

  const allDeps: Record<string, string> = {
    ...((pkgObj.dependencies as Record<string, string> | undefined) ?? {}),
    ...((pkgObj.devDependencies as Record<string, string> | undefined) ?? {}),
  }
  for (const [name, version] of Object.entries(allDeps)) {
    if (name.startsWith('@sentry/')) {
      signals.push({ signal: 'sentry-sdk-dep', evidence: `${name}@${version}` })
    }
  }

  const scripts = (pkgObj.scripts as Record<string, string> | undefined) ?? {}
  for (const [scriptName, cmd] of Object.entries(scripts)) {
    if (typeof cmd === 'string' && cmd.includes('sentry-cli')) {
      signals.push({ signal: 'sentry-cli-script', evidence: `${scriptName}: ${cmd.slice(0, 80)}` })
    }
  }

  return signals
}

// ─── 2. parsePackageJsonForSpotlight ─────────────────────────────────────────

/**
 * Read package.json and emit ObservabilitySignals for deps matching ^@spotlightjs/
 * (Pitfall 8: both @spotlightjs/spotlight and @spotlightjs/sidecar).
 */
export async function parsePackageJsonForSpotlight(projectRoot: string): Promise<ObservabilitySignal[]> {
  const signals: ObservabilitySignal[] = []
  const candidate = join(projectRoot, 'package.json')
  let real: string
  try {
    real = await resolveAllowedNamed(candidate, { roots: [projectRoot], allowedNames: ['package.json'] })
  } catch {
    return []
  }
  const pkg = await readJsonFile(real)
  if (!pkg || typeof pkg !== 'object') return []
  const pkgObj = pkg as Record<string, unknown>

  const allDeps: Record<string, string> = {
    ...((pkgObj.dependencies as Record<string, string> | undefined) ?? {}),
    ...((pkgObj.devDependencies as Record<string, string> | undefined) ?? {}),
  }
  for (const [name, version] of Object.entries(allDeps)) {
    if (name.startsWith('@spotlightjs/')) {
      signals.push({ signal: 'spotlight-dep', evidence: `${name}@${version}` })
    }
  }

  return signals
}

// ─── 3. parsePackageJsonForSentryCli ─────────────────────────────────────────

/**
 * Read package.json and emit ObservabilitySignals for:
 *  - deps including @sentry/cli (Pitfall 9: scoped package, not 'sentry-cli')
 *  - scripts containing substring 'sentry-cli'
 */
export async function parsePackageJsonForSentryCli(projectRoot: string): Promise<ObservabilitySignal[]> {
  const signals: ObservabilitySignal[] = []
  const candidate = join(projectRoot, 'package.json')
  let real: string
  try {
    real = await resolveAllowedNamed(candidate, { roots: [projectRoot], allowedNames: ['package.json'] })
  } catch {
    return []
  }
  const pkg = await readJsonFile(real)
  if (!pkg || typeof pkg !== 'object') return []
  const pkgObj = pkg as Record<string, unknown>

  const allDeps: Record<string, string> = {
    ...((pkgObj.dependencies as Record<string, string> | undefined) ?? {}),
    ...((pkgObj.devDependencies as Record<string, string> | undefined) ?? {}),
  }
  for (const [name, version] of Object.entries(allDeps)) {
    if (name === '@sentry/cli') {
      signals.push({ signal: 'sentry-cli-script', evidence: `${name}@${version}` })
    }
  }

  const scripts = (pkgObj.scripts as Record<string, string> | undefined) ?? {}
  for (const [scriptName, cmd] of Object.entries(scripts)) {
    if (typeof cmd === 'string' && cmd.includes('sentry-cli')) {
      signals.push({ signal: 'sentry-cli-script', evidence: `${scriptName}: ${cmd.slice(0, 80)}` })
    }
  }

  return signals
}

// ─── 4. parseSentryClirc ─────────────────────────────────────────────────────

/**
 * Existence-only check for <root>/.sentryclirc via resolveAllowedNamed.
 * Returns [{ signal: 'sentryclirc', evidence: '.sentryclirc:1' }] if present.
 * NO INI parsing (RESEARCH §Don't Hand-Roll).
 */
export async function parseSentryClirc(projectRoot: string): Promise<ObservabilitySignal[]> {
  const candidate = join(projectRoot, '.sentryclirc')
  try {
    await resolveAllowedNamed(candidate, { roots: [projectRoot], allowedNames: ['.sentryclirc'] })
    return [{ signal: 'sentryclirc', evidence: '.sentryclirc:1' }]
  } catch {
    return []
  }
}

// ─── 5. detectSpotlightDir ───────────────────────────────────────────────────

/**
 * Check whether <root>/.spotlight is a directory.
 * Returns [{ signal: 'spotlight-dir', evidence: '.spotlight/' }] if so.
 */
export async function detectSpotlightDir(projectRoot: string): Promise<ObservabilitySignal[]> {
  const dirPath = join(projectRoot, '.spotlight')
  if (!existsSync(dirPath)) return []
  try {
    const s = statSync(dirPath)
    if (!s.isDirectory()) return []
    return [{ signal: 'spotlight-dir', evidence: '.spotlight/' }]
  } catch {
    return []
  }
}

// ─── 6. detectSentryDsnEnv ───────────────────────────────────────────────────

/**
 * Read <root>/.env and <root>/.env.local via resolveAllowedNamed.
 * For each line, substring-match the literal 'SENTRY_DSN' (no value extraction).
 * Evidence: '<filename>:<lineno>' ONLY — never the DSN value (T-5-NoSecretRead).
 */
export async function detectSentryDsnEnv(projectRoot: string): Promise<ObservabilitySignal[]> {
  const signals: ObservabilitySignal[] = []
  const envFiles = ['.env', '.env.local']

  for (const envFile of envFiles) {
    const candidate = join(projectRoot, envFile)
    let real: string
    try {
      real = await resolveAllowedNamed(candidate, {
        roots: [projectRoot],
        allowedNames: ['.env', '.env.local'],
      })
    } catch {
      continue
    }
    let contents: string
    try {
      contents = await readFileAsync(real, 'utf8')
    } catch {
      continue
    }
    const lines = contents.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      if (line.includes('SENTRY_DSN')) {
        // NEVER store the DSN value — evidence is file:lineno only
        signals.push({ signal: 'sentry-dsn-env', evidence: `${envFile}:${i + 1}` })
      }
    }
  }

  return signals
}

// ─── 7. detectSentryCliBinary ────────────────────────────────────────────────

/**
 * Check whether sentry-cli binary is on PATH via `which sentry-cli`.
 * Uses execa argv array (no shell). 5s timeout (T-05-03-Subprocess-Timeout).
 */
export async function detectSentryCliBinary(): Promise<ObservabilitySignal[]> {
  try {
    const result = await execa('which', ['sentry-cli'], {
      timeout: SENTRY_CLI_BINARY_TIMEOUT_MS,
      reject: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (result.exitCode === 0 && result.stdout.trim()) {
      return [{ signal: 'sentry-cli-binary', evidence: result.stdout.trim() }]
    }
    return []
  } catch {
    return []
  }
}

// ─── 8. parseCiWorkflowsForSentry ────────────────────────────────────────────

/**
 * List <root>/.github/workflows/*.yml via readdir.
 * For each file, validate via resolveAllowedNamed with extension '.yml' and
 * root restricted to <root>/.github/workflows (Pitfall 6 — dir confinement).
 * Substring-match 'sentry-cli' in each accepted file.
 */
export async function parseCiWorkflowsForSentry(projectRoot: string): Promise<ObservabilitySignal[]> {
  const workflowsDir = join(projectRoot, '.github', 'workflows')
  if (!existsSync(workflowsDir)) return []

  let entries: string[]
  try {
    entries = await readdirAsync(workflowsDir, { encoding: 'utf8' }) as string[]
  } catch {
    return []
  }

  const signals: ObservabilitySignal[] = []

  for (const entry of entries) {
    const filePath = join(workflowsDir, entry)
    let real: string
    try {
      real = await resolveAllowedNamed(filePath, {
        roots: [workflowsDir],
        extension: '.yml',
      })
    } catch {
      // Wrong extension or path outside workflows dir — skip silently
      continue
    }

    let contents: string
    try {
      contents = await readFileAsync(real, 'utf8')
    } catch {
      continue
    }

    const lines = contents.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes('sentry-cli')) {
        signals.push({ signal: 'sentry-cli-ci', evidence: `${entry}:${i + 1}` })
        break // one signal per file is sufficient
      }
    }
  }

  return signals
}

// ─── 9. parseInfisicalConfig ─────────────────────────────────────────────────

/**
 * Read <root>/.infisical.json and return SecretsResponse discriminated union.
 * Only checks for workspaceId field presence — no secret content extracted.
 * Per RESEARCH §Code Examples lines 832–867.
 */
export async function parseInfisicalConfig(projectRoot: string): Promise<SecretsResponse> {
  const candidate = join(projectRoot, '.infisical.json')
  let real: string
  try {
    real = await resolveAllowedNamed(candidate, {
      roots: [projectRoot],
      allowedNames: ['.infisical.json'],
    })
  } catch {
    return { state: 'absent' }
  }

  let raw: string
  try {
    raw = await readFileAsync(real, 'utf8')
  } catch {
    return { state: 'absent' }
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return { state: 'present-invalid', reason: 'not a JSON object' }
    }
    const obj = parsed as Record<string, unknown>
    if (typeof obj.workspaceId !== 'string' || obj.workspaceId.length === 0) {
      return { state: 'present-invalid', reason: 'missing or empty workspaceId' }
    }
    return {
      state: 'present-valid',
      workspaceId: obj.workspaceId,
      defaultEnvironment:
        typeof obj.defaultEnvironment === 'string' ? obj.defaultEnvironment : undefined,
    }
  } catch (e) {
    return {
      state: 'present-invalid',
      reason: e instanceof Error ? e.message : 'parse failed',
    }
  }
}
