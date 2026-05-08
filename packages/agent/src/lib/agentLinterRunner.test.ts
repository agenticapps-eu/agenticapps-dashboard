/**
 * Tests for agentLinterRunner.ts — subprocess + 5-class outcome discrimination.
 *
 * Privacy invariant: argv MUST contain '--local' and '--json'.
 * Subprocess: argv array form only (no shell expansion — T-05-02-Subprocess-Inj).
 * Supply chain invariant (D-5-21): spawn cmd is `node`, arg[0] is a path under
 * `@agenticapps/agentlinter` (NEVER bare `npx <name>` against the open registry).
 *
 * 8 test cases:
 *   1. Argv assertion: cmd is `node`, arg[0] under @agenticapps/agentlinter,
 *      args contain --local and --json (privacy + supply-chain invariants)
 *   2. kind: 'ok' — exit 0 + valid JSON stdout
 *   3. kind: 'not-installed' — execa throws (spawn failure)
 *   4. kind: 'timeout' — proc.timedOut true
 *   5. kind: 'error' — non-zero exit
 *   6. kind: 'unparseable' — exit 0 with garbage stdout
 *   7. kind: 'ok' — non-zero exit but stdout is valid JSON
 *   8. Real-binary integration test (gated by AGENTLINTER_REAL env)
 */

import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// We need to mock execa before importing the runner
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import { runAgentLinter } from './agentLinterRunner.js'

const mockedExeca = execa as ReturnType<typeof vi.fn>

const VALID_REPORT = JSON.stringify({
  score: 95,
  categories: [],
  diagnostics: [],
  files: [],
  timestamp: '2026-05-07T12:00:00Z',
})

/**
 * Fake bin path for unit tests so the runner doesn't need
 * `@agenticapps/agentlinter` resolved in node_modules. Production callers omit
 * `binPath` and resolution runs via createRequire against the bundled dep.
 */
const FAKE_BIN_PATH =
  '/fake/node_modules/@agenticapps/agentlinter/dist/bin.js'

describe('runAgentLinter — privacy + supply-chain invariants + 5-class outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('1. invariants: spawn cmd is `node`, arg[0] under @agenticapps/agentlinter, args contain --local and --json', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 0,
      stdout: VALID_REPORT,
      stderr: '',
      timedOut: false,
    })

    await runAgentLinter('/some/project/root', { binPath: FAKE_BIN_PATH })

    expect(mockedExeca).toHaveBeenCalledOnce()
    const [cmd, args] = mockedExeca.mock.calls[0] as [string, string[], unknown]

    // Supply-chain invariant (D-5-21): spawn the local resolved bin via node, NEVER bare npx
    expect(cmd).toBe('node')
    expect(args[0]).toMatch(/@agenticapps[\/\\]agentlinter[\/\\]/)
    // Privacy invariant: --local MUST be present (T-05-02-AgentLinter-Local)
    expect(args).toContain('--local')
    // JSON output flag
    expect(args).toContain('--json')
  })

  it('2. kind: "ok" — exit 0 + valid JSON stdout', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 0,
      stdout: VALID_REPORT,
      stderr: '',
      timedOut: false,
    })

    const result = await runAgentLinter('/some/project', { binPath: FAKE_BIN_PATH })
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.report).toMatchObject({ score: 95 })
    }
  })

  it('3. kind: "not-installed" — execa throws (spawn failure)', async () => {
    mockedExeca.mockRejectedValue(new Error('spawn error'))

    const result = await runAgentLinter('/some/project', { binPath: FAKE_BIN_PATH })
    expect(result.kind).toBe('not-installed')
  })

  it('4. kind: "timeout" — proc.timedOut true', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: '',
      timedOut: true,
    })

    const result = await runAgentLinter('/some/project', { binPath: FAKE_BIN_PATH })
    expect(result.kind).toBe('timeout')
  })

  it('5. kind: "error" — non-zero exit, non-JSON stdout', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 1,
      stdout: 'some error output that is not json',
      stderr: 'Unexpected runtime error',
      timedOut: false,
    })

    const result = await runAgentLinter('/some/project', { binPath: FAKE_BIN_PATH })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toBe('Unexpected runtime error')
    }
  })

  it('6. kind: "unparseable" — exit 0 with garbage stdout', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 0,
      stdout: '<<<not json>>>',
      stderr: '',
      timedOut: false,
    })

    const result = await runAgentLinter('/some/project', { binPath: FAKE_BIN_PATH })
    expect(result.kind).toBe('unparseable')
    if (result.kind === 'unparseable') {
      expect(result.rawStdout).toBe('<<<not json>>>')
    }
  })

  it('7. kind: "ok" — non-zero exit but stdout is valid JSON', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 1,
      stdout: VALID_REPORT,
      stderr: 'warnings emitted',
      timedOut: false,
    })

    const result = await runAgentLinter('/some/project', { binPath: FAKE_BIN_PATH })
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.report).toMatchObject({ score: 95 })
    }
  })

  it('8. real-binary integration (gated by AGENTLINTER_REAL env)', async () => {
    if (!process.env.AGENTLINTER_REAL) {
      // Skip by passing without assertion
      return
    }

    // Unmock execa for this test
    vi.doUnmock('execa')

    const tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-al-real-')))
    mkdirSync(join(tmpRoot, '.claude'), { recursive: true })
    writeFileSync(join(tmpRoot, 'CLAUDE.md'), '# Test project\n')

    try {
      // Import the real module
      const { runAgentLinter: realRunner } = await import('./agentLinterRunner.js')
      const result = await realRunner(tmpRoot)
      // Real binary test: accept ok or not-installed
      expect(['ok', 'not-installed']).toContain(result.kind)
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
