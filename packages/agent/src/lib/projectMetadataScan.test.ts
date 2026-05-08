/**
 * Tests for projectMetadataScan.ts — 9 scanner functions.
 * TDD RED phase: all tests must fail until the implementation is written.
 *
 * Coverage:
 *  1. parsePackageJsonForSentry — Sentry SDK deps + sentry-cli script detection
 *  2. parsePackageJsonForSpotlight — @spotlightjs/* family (Pitfall 8)
 *  3. parsePackageJsonForSentryCli — @sentry/cli dep + script substring (Pitfall 9)
 *  4. parseSentryClirc — existence-only check
 *  5. detectSpotlightDir — .spotlight/ directory presence
 *  6. detectSentryDsnEnv — .env line presence without DSN value extraction (privacy invariant)
 *  7. detectSentryCliBinary — execa mock for which sentry-cli
 *  8. parseCiWorkflowsForSentry — .github/workflows/*.yml grep + path safety
 *  9. parseInfisicalConfig — 4 cases (absent, valid, invalid, malformed JSON)
 */
import { join } from 'node:path'
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock execa for detectSentryCliBinary tests
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'

import {
  parsePackageJsonForSentry,
  parsePackageJsonForSpotlight,
  parsePackageJsonForSentryCli,
  parseSentryClirc,
  detectSpotlightDir,
  detectSentryDsnEnv,
  detectSentryCliBinary,
  parseCiWorkflowsForSentry,
  parseInfisicalConfig,
} from './projectMetadataScan.js'

const mockedExeca = execa as ReturnType<typeof vi.fn>

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makeTmpRoot(): { root: string; cleanup: () => void } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-scan-')))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

function writePackageJson(root: string, pkg: Record<string, unknown>): void {
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg))
}

// ─── 1. parsePackageJsonForSentry ────────────────────────────────────────────

describe('parsePackageJsonForSentry', () => {
  let cleanup: () => void

  afterEach(() => cleanup?.())

  it('returns [] when package.json is absent', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    const result = await parsePackageJsonForSentry(root)
    expect(result).toEqual([])
  })

  it('returns [] when no @sentry/* deps', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writePackageJson(root, { name: 'test', dependencies: { react: '^18.0.0' } })
    const result = await parsePackageJsonForSentry(root)
    expect(result).toEqual([])
  })

  it('emits sentry-sdk-dep signal for @sentry/node dep', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writePackageJson(root, { dependencies: { '@sentry/node': '^8.0.0' } })
    const result = await parsePackageJsonForSentry(root)
    expect(result).toHaveLength(1)
    expect(result[0]!.signal).toBe('sentry-sdk-dep')
    expect(result[0]!.evidence).toContain('@sentry/node')
  })

  it('emits sentry-sdk-dep signal for each @sentry/* dep (@sentry/node + @sentry/react)', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writePackageJson(root, {
      dependencies: { '@sentry/node': '^8.0.0' },
      devDependencies: { '@sentry/react': '^8.0.0' },
    })
    const result = await parsePackageJsonForSentry(root)
    expect(result).toHaveLength(2)
    const signals = result.map((r) => r.evidence)
    expect(signals.some((e) => e.includes('@sentry/node'))).toBe(true)
    expect(signals.some((e) => e.includes('@sentry/react'))).toBe(true)
  })

  it('emits sentry-cli-script signal when scripts contain sentry-cli substring', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writePackageJson(root, { scripts: { release: 'sentry-cli releases new $VERSION' } })
    const result = await parsePackageJsonForSentry(root)
    const cliSignals = result.filter((r) => r.signal === 'sentry-cli-script')
    expect(cliSignals).toHaveLength(1)
    expect(cliSignals[0]!.evidence).toContain('release')
  })
})

// ─── 2. parsePackageJsonForSpotlight ─────────────────────────────────────────

describe('parsePackageJsonForSpotlight', () => {
  let cleanup: () => void

  afterEach(() => cleanup?.())

  it('returns [] when no @spotlightjs/* deps', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writePackageJson(root, { dependencies: { react: '^18.0.0' } })
    const result = await parsePackageJsonForSpotlight(root)
    expect(result).toEqual([])
  })

  it('emits spotlight-dep signal for @spotlightjs/spotlight', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writePackageJson(root, { dependencies: { '@spotlightjs/spotlight': '^4.0.0' } })
    const result = await parsePackageJsonForSpotlight(root)
    expect(result.some((r) => r.signal === 'spotlight-dep' && r.evidence.includes('@spotlightjs/spotlight'))).toBe(true)
  })

  it('emits spotlight-dep signal for @spotlightjs/sidecar (Pitfall 8 — sidecar variant)', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writePackageJson(root, { devDependencies: { '@spotlightjs/sidecar': '^2.0.0' } })
    const result = await parsePackageJsonForSpotlight(root)
    expect(result.some((r) => r.signal === 'spotlight-dep' && r.evidence.includes('@spotlightjs/sidecar'))).toBe(true)
  })
})

// ─── 3. parsePackageJsonForSentryCli ─────────────────────────────────────────

describe('parsePackageJsonForSentryCli', () => {
  let cleanup: () => void

  afterEach(() => cleanup?.())

  it('emits signal for @sentry/cli dep (Pitfall 9 — scoped name)', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writePackageJson(root, { devDependencies: { '@sentry/cli': '^4.0.0' } })
    const result = await parsePackageJsonForSentryCli(root)
    expect(result.some((r) => r.evidence.includes('@sentry/cli'))).toBe(true)
  })

  it('emits sentry-cli-script signal for script containing sentry-cli substring', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writePackageJson(root, { scripts: { release: 'npx sentry-cli releases new v1.0' } })
    const result = await parsePackageJsonForSentryCli(root)
    const cliSignals = result.filter((r) => r.signal === 'sentry-cli-script')
    expect(cliSignals.length).toBeGreaterThan(0)
  })
})

// ─── 4. parseSentryClirc ─────────────────────────────────────────────────────

describe('parseSentryClirc', () => {
  let cleanup: () => void

  afterEach(() => cleanup?.())

  it('returns [] when .sentryclirc does not exist', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    const result = await parseSentryClirc(root)
    expect(result).toEqual([])
  })

  it('returns sentryclirc signal when .sentryclirc exists (existence-only, no content read)', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writeFileSync(join(root, '.sentryclirc'), '[auth]\ntoken=abc123\n')
    const result = await parseSentryClirc(root)
    expect(result).toHaveLength(1)
    expect(result[0]!.signal).toBe('sentryclirc')
    // Existence-only — evidence must not contain file content
    expect(result[0]!.evidence).not.toContain('abc123')
    expect(result[0]!.evidence).not.toContain('token')
  })
})

// ─── 5. detectSpotlightDir ───────────────────────────────────────────────────

describe('detectSpotlightDir', () => {
  let cleanup: () => void

  afterEach(() => cleanup?.())

  it('returns [] when .spotlight does not exist', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    const result = await detectSpotlightDir(root)
    expect(result).toEqual([])
  })

  it('returns [] when .spotlight is a file (not a directory)', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writeFileSync(join(root, '.spotlight'), 'not a dir')
    const result = await detectSpotlightDir(root)
    expect(result).toEqual([])
  })

  it('returns spotlight-dir signal when .spotlight/ is a directory', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    mkdirSync(join(root, '.spotlight'))
    const result = await detectSpotlightDir(root)
    expect(result).toHaveLength(1)
    expect(result[0]!.signal).toBe('spotlight-dir')
  })
})

// ─── 6. detectSentryDsnEnv ───────────────────────────────────────────────────

describe('detectSentryDsnEnv', () => {
  let cleanup: () => void

  afterEach(() => cleanup?.())

  it('returns [] when .env does not exist', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    const result = await detectSentryDsnEnv(root)
    expect(result).toEqual([])
  })

  it('returns sentry-dsn-env signal when .env contains SENTRY_DSN', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writeFileSync(join(root, '.env'), 'SENTRY_DSN=https://abc123@secret.example.io/1\n')
    const result = await detectSentryDsnEnv(root)
    expect(result.some((r) => r.signal === 'sentry-dsn-env')).toBe(true)
    const signal = result.find((r) => r.signal === 'sentry-dsn-env')!
    // Evidence must carry file:lineno only — never the DSN value (privacy invariant T-5-NoSecretRead)
    expect(signal.evidence).toContain('.env:')
    expect(signal.evidence).not.toContain('abc123')
    expect(signal.evidence).not.toContain('https://')
    expect(signal.evidence).not.toContain('secret.example.io')
  })

  it('privacy invariant: evidence string does NOT contain the DSN value', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writeFileSync(join(root, '.env'), 'SENTRY_DSN=https://secret-123@io/1\nOTHER=foo\n')
    const result = await detectSentryDsnEnv(root)
    for (const signal of result) {
      expect(signal.evidence).not.toContain('secret-123')
    }
  })
})

// ─── 7. detectSentryCliBinary ────────────────────────────────────────────────

describe('detectSentryCliBinary', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns sentry-cli-binary signal when which sentry-cli exits 0', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 0,
      stdout: '/usr/local/bin/sentry-cli',
      stderr: '',
    })
    const result = await detectSentryCliBinary()
    expect(result).toHaveLength(1)
    expect(result[0]!.signal).toBe('sentry-cli-binary')
    expect(result[0]!.evidence).toContain('sentry-cli')
  })

  it('returns [] when which sentry-cli exits non-zero (binary not found)', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'not found',
    })
    const result = await detectSentryCliBinary()
    expect(result).toEqual([])
  })

  it('returns [] on execa spawn error (binary not on PATH)', async () => {
    mockedExeca.mockRejectedValue(new Error('ENOENT'))
    const result = await detectSentryCliBinary()
    expect(result).toEqual([])
  })
})

// ─── 8. parseCiWorkflowsForSentry ────────────────────────────────────────────

describe('parseCiWorkflowsForSentry', () => {
  let cleanup: () => void

  afterEach(() => cleanup?.())

  it('returns [] when .github/workflows does not exist', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    const result = await parseCiWorkflowsForSentry(root)
    expect(result).toEqual([])
  })

  it('emits sentry-cli-ci signal when workflow .yml contains sentry-cli', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      join(root, '.github', 'workflows', 'release.yml'),
      'steps:\n  - run: sentry-cli releases new $VERSION\n',
    )
    const result = await parseCiWorkflowsForSentry(root)
    expect(result.some((r) => r.signal === 'sentry-cli-ci')).toBe(true)
    const signal = result.find((r) => r.signal === 'sentry-cli-ci')!
    expect(signal.evidence).toContain('release.yml')
  })

  it('rejects path under .github/no-workflows/ (path outside .github/workflows root)', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    mkdirSync(join(root, '.github', 'no-workflows'), { recursive: true })
    writeFileSync(
      join(root, '.github', 'no-workflows', 'x.yml'),
      'run: sentry-cli releases new',
    )
    // parseCiWorkflowsForSentry only scans .github/workflows — the no-workflows dir is never scanned
    // This test verifies no signal is emitted from the wrong directory
    const result = await parseCiWorkflowsForSentry(root)
    expect(result.every((r) => !r.evidence.includes('no-workflows'))).toBe(true)
  })

  it('does not emit signal for files with wrong extension (.txt in workflows dir)', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      join(root, '.github', 'workflows', 'notes.txt'),
      'run: sentry-cli releases new',
    )
    const result = await parseCiWorkflowsForSentry(root)
    expect(result).toEqual([])
  })
})

// ─── 9. parseInfisicalConfig ─────────────────────────────────────────────────

describe('parseInfisicalConfig', () => {
  let cleanup: () => void

  afterEach(() => cleanup?.())

  it('returns absent when .infisical.json does not exist', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    const result = await parseInfisicalConfig(root)
    expect(result.state).toBe('absent')
  })

  it('returns present-valid for valid .infisical.json with workspaceId + defaultEnvironment', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writeFileSync(
      join(root, '.infisical.json'),
      JSON.stringify({ workspaceId: 'ws-abc-123', defaultEnvironment: 'dev' }),
    )
    const result = await parseInfisicalConfig(root)
    expect(result.state).toBe('present-valid')
    if (result.state === 'present-valid') {
      expect(result.workspaceId).toBe('ws-abc-123')
      expect(result.defaultEnvironment).toBe('dev')
    }
  })

  it('returns present-invalid when .infisical.json is missing workspaceId', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writeFileSync(join(root, '.infisical.json'), JSON.stringify({ defaultEnvironment: 'dev' }))
    const result = await parseInfisicalConfig(root)
    expect(result.state).toBe('present-invalid')
  })

  it('returns present-invalid when .infisical.json is malformed JSON', async () => {
    const { root, cleanup: c } = makeTmpRoot()
    cleanup = c
    writeFileSync(join(root, '.infisical.json'), '{ not valid json }')
    const result = await parseInfisicalConfig(root)
    expect(result.state).toBe('present-invalid')
  })
})
