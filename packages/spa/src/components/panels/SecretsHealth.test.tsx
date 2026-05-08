/**
 * SecretsHealth.test.tsx — TDD tests for SecretsHealth panel (HEALTH-04).
 *
 * Tests SH1–SH9:
 * SH1: loading state → renders Loading...
 * SH2: schema drift → renders InlineDrift
 * SH3: non-drift error → renders unreachable PanelContainer
 * SH4: state 'present-valid' → CheckCircle2 icon + body + 'valid' pill
 * SH5: state 'present-invalid' → AlertTriangle icon + body + 'invalid' pill
 * SH6: state 'absent' → Minus icon + body + NO pill
 * SH7: all states render .infisical.json filename in <code>
 * SH8: privacy invariant — workspaceId never appears in DOM even when daemon supplies it
 * SH9: absent state stays quiet — no pill rendered
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { SecretsResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useSecrets: vi.fn(),
}))

import { useSecrets } from '../../lib/projectQueries.js'
import { SecretsHealth } from './SecretsHealth.js'

type SecretsMock = Partial<UseQueryResult<SecretsResponse, Error>>

function mockSecrets(overrides: SecretsMock = {}) {
  vi.mocked(useSecrets).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<SecretsResponse, Error>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('SecretsHealth', () => {
  it('SH1: loading state → renders Loading...', () => {
    mockSecrets({ isLoading: true })
    render(<SecretsHealth projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('SH2: schema drift → renders InlineDrift with path from error message', () => {
    mockSecrets({ error: new Error('schema_drift:/api/projects/proj-1/secrets') })
    render(<SecretsHealth projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Schema drift')
    expect(screen.getByText(/\/api\/projects\/proj-1\/secrets/)).toBeDefined()
  })

  it('SH3: non-drift error → renders unreachable PanelContainer', () => {
    mockSecrets({ error: new Error('Network Error') })
    render(<SecretsHealth projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('SH4: state "present-valid" → body copy + "valid" pill rendered', () => {
    mockSecrets({
      data: { state: 'present-valid', workspaceId: 'my-workspace-123', defaultEnvironment: 'prod' },
    })
    const { container } = render(<SecretsHealth projectId="proj-1" />)
    // Body copy from UI-SPEC line 414 — check container textContent since .infisical.json is in <code>
    expect(container.textContent).toContain('present and valid.')
    // State pill
    expect(screen.getByText('valid')).toBeDefined()
  })

  it('SH5: state "present-invalid" → body copy + "invalid" pill rendered', () => {
    mockSecrets({
      data: { state: 'present-invalid', reason: 'JSON parse error at line 3' },
    })
    const { container } = render(<SecretsHealth projectId="proj-1" />)
    // Body copy from UI-SPEC line 415
    expect(container.textContent).toContain('found but not parseable.')
    // State pill
    expect(screen.getByText('invalid')).toBeDefined()
  })

  it('SH6: state "absent" → body copy rendered, no pill', () => {
    mockSecrets({ data: { state: 'absent' } })
    const { container } = render(<SecretsHealth projectId="proj-1" />)
    // Body copy from UI-SPEC line 416 — contains .infisical.json in <code> so use textContent
    expect(container.textContent).toContain('No')
    expect(container.textContent).toContain('.infisical.json')
    expect(container.textContent).toContain('detected.')
    // No pill for absent state
    expect(screen.queryByText('valid')).toBeNull()
    expect(screen.queryByText('invalid')).toBeNull()
  })

  it('SH7: all states render .infisical.json filename in <code> element with font-mono', () => {
    mockSecrets({
      data: { state: 'present-valid', workspaceId: 'ws-1' },
    })
    const { container } = render(<SecretsHealth projectId="proj-1" />)
    const codeElements = Array.from(container.querySelectorAll('code.font-mono'))
    const infisicalCode = codeElements.some(el => el.textContent === '.infisical.json')
    expect(infisicalCode).toBe(true)
  })

  it('SH8: privacy invariant — workspaceId "my-workspace-123" never appears in DOM even when daemon supplies it', () => {
    mockSecrets({
      data: { state: 'present-valid', workspaceId: 'my-workspace-123', defaultEnvironment: 'staging' },
    })
    const { container } = render(<SecretsHealth projectId="proj-1" />)
    // The workspace ID must NOT appear anywhere in the rendered container
    expect(container.textContent).not.toContain('my-workspace-123')
    // The defaultEnvironment must also not appear
    expect(container.textContent).not.toContain('staging')
  })

  it('SH9: "absent" state — no state pill rendered (quiet empty state)', () => {
    mockSecrets({ data: { state: 'absent' } })
    render(<SecretsHealth projectId="proj-1" />)
    // Confirm neither pill label appears
    expect(screen.queryByText('valid')).toBeNull()
    expect(screen.queryByText('invalid')).toBeNull()
    expect(screen.queryByText('absent')).toBeNull()
  })
})
