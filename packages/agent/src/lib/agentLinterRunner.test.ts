/**
 * Tests for agentLinterRunner.ts — subprocess + 5-class outcome discrimination.
 *
 * Privacy invariant: argv MUST contain '--local' and '--json'.
 * Subprocess: argv array form only (no shell expansion — T-05-02-Subprocess-Inj).
 *
 * 7 test cases:
 *   1. Argv assertion: spawned args contain '--local' and '--json' (privacy invariant)
 *   2. kind: 'ok' — exit 0 + valid JSON stdout
 *   3. kind: 'not-installed' — execa throws (npx couldn't start)
 *   4. kind: 'timeout' — proc.timedOut true
 *   5. kind: 'error' — non-zero exit without E404 / not-found pattern
 *   6. kind: 'unparseable' — exit 0 with garbage stdout
 *   7. kind: 'not-installed' — non-zero exit with E404 in stderr
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

describe('runAgentLinter — privacy invariant + 5-class outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('1. argv invariant: spawned call includes --local and --json', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 0,
      stdout: VALID_REPORT,
      stderr: '',
      timedOut: false,
    })

    await runAgentLinter('/some/project/root')

    expect(mockedExeca).toHaveBeenCalledOnce()
    const [cmd, args] = mockedExeca.mock.calls[0] as [string, string[], unknown]

    expect(cmd).toBe('npx')
    // Privacy invariant: --local MUST be present (T-05-02-AgentLinter-Local)
    expect(args).toContain('--local')
    // JSON output flag
    expect(args).toContain('--json')
    // Must NOT use shell-string form (no template literals in the actual source)
  })

  it('2. kind: "ok" — exit 0 + valid JSON stdout', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 0,
      stdout: VALID_REPORT,
      stderr: '',
      timedOut: false,
    })

    const result = await runAgentLinter('/some/project')
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.report).toMatchObject({ score: 95 })
    }
  })

  it('3. kind: "not-installed" — execa throws (npx could not start)', async () => {
    mockedExeca.mockRejectedValue(new Error('spawn error — npx not found'))

    const result = await runAgentLinter('/some/project')
    expect(result.kind).toBe('not-installed')
  })

  it('4. kind: "timeout" — proc.timedOut true', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: '',
      timedOut: true,
    })

    const result = await runAgentLinter('/some/project')
    expect(result.kind).toBe('timeout')
  })

  it('5. kind: "error" — non-zero exit, no E404 pattern, non-JSON stdout', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 1,
      stdout: 'some error output that is not json',
      stderr: 'Unexpected runtime error',
      timedOut: false,
    })

    const result = await runAgentLinter('/some/project')
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

    const result = await runAgentLinter('/some/project')
    expect(result.kind).toBe('unparseable')
    if (result.kind === 'unparseable') {
      expect(result.rawStdout).toBe('<<<not json>>>')
    }
  })

  it('7. kind: "not-installed" — non-zero exit with E404 in stderr', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'npm error 404 Not Found - GET https://registry.npmjs.org/agentlinter',
      timedOut: false,
    })

    const result = await runAgentLinter('/some/project')
    expect(result.kind).toBe('not-installed')
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
