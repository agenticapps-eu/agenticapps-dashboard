/**
 * SkillHealth.test.tsx — TDD tests for SkillHealth panel (HEALTH-02).
 *
 * Tests SH1–SH14:
 * SH1:  Loading state → renders Loading...
 * SH2:  Schema drift → renders InlineDrift
 * SH3:  Non-drift error → renders unreachable PanelContainer
 * SH4:  kind:'ok' happy path → renders project score badge + file rows
 * SH5:  Row click → expands inline detail; aria-expanded flips to true; click again collapses
 * SH6:  Multiple rows can be expanded simultaneously
 * SH7:  Esc on expanded row → collapses + aria-expanded flips back
 * SH8:  Severity glyph mapping: error→🔴, warning→🟠, info→⚪ all render
 * SH9:  0 findings renders '0 findings' text explicitly
 * SH10: kind:'not-installed' → renders CodeBlock with npm install -g agentlinter
 * SH11: kind:'timeout' → renders timeout copy + Retry scan button
 * SH12: Retry button click → calls apiFetch with ?bypassCache=1
 * SH13: kind:'error' → renders stderr in <pre> + Exit code label
 * SH14: kind:'unparseable' → renders unparseable copy with exit code
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { AgentLinterResponse } from '@agenticapps/dashboard-shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../lib/projectQueries.js', () => ({
  useAgentLinter: vi.fn(),
}))

vi.mock('../../lib/api.js', () => ({
  apiFetch: vi.fn(),
}))

import { useAgentLinter } from '../../lib/projectQueries.js'
import { apiFetch } from '../../lib/api.js'
import { SkillHealth } from './SkillHealth.js'

type AgentLinterMock = Partial<UseQueryResult<AgentLinterResponse, Error>>

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

function mockQuery(overrides: AgentLinterMock = {}) {
  vi.mocked(useAgentLinter).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<AgentLinterResponse, Error>)
}

const OK_DATA: AgentLinterResponse = {
  kind: 'ok',
  report: {
    score: 87,
    categories: [],
    diagnostics: [
      { severity: 'error', category: 'style', rule: 'position-risk', file: 'skill-a/SKILL.md', message: 'Position risk found' },
      { severity: 'warning', category: 'style', rule: 'missing-description', file: 'skill-a/SKILL.md', message: 'Missing desc' },
      { severity: 'info', category: 'style', rule: 'line-length', file: 'skill-b/SKILL.md', message: 'Line too long' },
    ],
    files: ['skill-a/SKILL.md', 'skill-b/SKILL.md'],
    timestamp: '2026-05-07T12:00:00.000Z',
  },
  cachedAt: '2026-05-07T12:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SkillHealth', () => {
  it('SH1: loading → renders Loading...', () => {
    mockQuery({ isLoading: true })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('SH2: schema drift → renders InlineDrift (heading contains Schema drift)', () => {
    mockQuery({ error: new Error('schema_drift:/api/projects/proj-1/agentlinter') })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Schema drift')
    expect(screen.getByText(/\/api\/projects\/proj-1\/agentlinter/)).toBeDefined()
  })

  it('SH3: non-drift error → renders unreachable PanelContainer', () => {
    mockQuery({ error: new Error('Network Error') })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('SH4: kind:ok — renders project score badge + 2 file rows', () => {
    mockQuery({ data: OK_DATA })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })
    // Project-level score badge
    expect(screen.getByText('87/100')).toBeDefined()
    // File rows
    expect(screen.getByText('skill-a/SKILL.md')).toBeDefined()
    expect(screen.getByText('skill-b/SKILL.md')).toBeDefined()
  })

  it('SH5: row click expands inline detail; aria-expanded flips; click again collapses', () => {
    mockQuery({ data: OK_DATA })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })

    const btn = screen.getByRole('button', { name: (name) => name.includes('skill-a/SKILL.md') })
    expect(btn.getAttribute('aria-expanded')).toBe('false')

    // Click to expand
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    // Expanded detail shows the diagnostic message
    expect(screen.getByText('Position risk found')).toBeDefined()

    // Click to collapse
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Position risk found')).toBeNull()
  })

  it('SH6: multiple rows can be expanded simultaneously (no accordion)', () => {
    mockQuery({ data: OK_DATA })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })

    const btnA = screen.getByRole('button', { name: (name) => name.includes('skill-a/SKILL.md') })
    const btnB = screen.getByRole('button', { name: (name) => name.includes('skill-b/SKILL.md') })

    fireEvent.click(btnA)
    fireEvent.click(btnB)

    expect(btnA.getAttribute('aria-expanded')).toBe('true')
    expect(btnB.getAttribute('aria-expanded')).toBe('true')
    // Both expanded details visible
    expect(screen.getByText('Position risk found')).toBeDefined()
    expect(screen.getByText('Line too long')).toBeDefined()
  })

  it('SH7: Esc on expanded row collapses it and aria-expanded flips back to false', () => {
    mockQuery({ data: OK_DATA })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })

    const btn = screen.getByRole('button', { name: (name) => name.includes('skill-a/SKILL.md') })
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')

    // Press Escape on the button
    fireEvent.keyDown(btn, { key: 'Escape' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('SH8: severity glyph mapping — error→🔴, warning→🟠, info→⚪ all render in expanded rows', () => {
    mockQuery({ data: OK_DATA })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })

    // Expand both rows
    const btnA = screen.getByRole('button', { name: (name) => name.includes('skill-a/SKILL.md') })
    const btnB = screen.getByRole('button', { name: (name) => name.includes('skill-b/SKILL.md') })
    fireEvent.click(btnA)
    fireEvent.click(btnB)

    // All 3 glyphs should be present in the DOM (in expanded detail rows)
    expect(screen.getAllByText('🔴').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('🟠').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('⚪').length).toBeGreaterThanOrEqual(1)
  })

  it('SH9: 0 findings row renders "0 findings" text explicitly (positive signal)', () => {
    const noFindings: AgentLinterResponse = {
      kind: 'ok',
      report: {
        score: 100,
        categories: [],
        diagnostics: [],
        files: ['clean-skill/SKILL.md'],
        timestamp: '2026-05-07T12:00:00.000Z',
      },
      cachedAt: '2026-05-07T12:00:00.000Z',
    }
    mockQuery({ data: noFindings })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })
    expect(screen.getByText('0 findings')).toBeDefined()
  })

  it('SH10: kind:not-installed → renders AgentLinter not installed copy + CodeBlock', () => {
    mockQuery({ data: { kind: 'not-installed' } })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })
    expect(screen.getByText(/AgentLinter not installed\./)).toBeDefined()
    // CodeBlock renders the command as text
    expect(screen.getByText('npm install -g agentlinter')).toBeDefined()
  })

  it('SH11: kind:timeout → renders timeout copy + Retry scan button', () => {
    mockQuery({ data: { kind: 'timeout' } })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })
    expect(screen.getByText('Lint scan timed out after 30 seconds.')).toBeDefined()
    // Button has aria-label; match on visible text via getByText
    expect(screen.getByText('Retry scan')).toBeDefined()
    // Confirm it's a button role via aria-label containing "Retry"
    expect(screen.getByRole('button', { name: /Retry agentlinter scan/i })).toBeDefined()
  })

  it('SH12: Retry button click calls apiFetch with ?bypassCache=1 URL', async () => {
    mockQuery({ data: { kind: 'timeout' } })
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, data: { kind: 'timeout' } })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })

    const retryBtn = screen.getByRole('button', { name: /Retry agentlinter scan/i })
    fireEvent.click(retryBtn)

    // apiFetch must have been called with bypassCache=1 in the URL
    await vi.waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
        expect.stringContaining('bypassCache=1'),
        expect.anything(),
      )
    })
  })

  it('SH13: kind:error → renders stderr in <pre> + Exit code label', () => {
    const errorData: AgentLinterResponse = {
      kind: 'error',
      exitCode: 2,
      stderr: 'agentlinter: unexpected token at line 5',
    }
    mockQuery({ data: errorData })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })
    expect(screen.getByText('Lint scan failed.')).toBeDefined()
    // stderr in <pre>
    expect(screen.getByText('agentlinter: unexpected token at line 5')).toBeDefined()
    // Exit code label
    expect(screen.getByText('Exit code: 2')).toBeDefined()
  })

  it('SH14: kind:unparseable → renders unparseable copy with exit code', () => {
    const unparseableData: AgentLinterResponse = {
      kind: 'unparseable',
      exitCode: 1,
      rawStdout: 'garbage output',
    }
    mockQuery({ data: unparseableData })
    const { wrapper } = makeWrapper()
    render(<SkillHealth projectId="proj-1" />, { wrapper })
    expect(screen.getByText(/Lint scan failed \(exit 1\) — see daemon log\./)).toBeDefined()
  })
})
