/**
 * IntegrationsHealth.test.tsx — TDD tests for IntegrationsHealth panel (HEALTH-05).
 *
 * Tests IH1–IH12:
 * IH1: loading state → renders Loading...
 * IH2: schema drift → renders InlineDrift
 * IH3: non-drift error → renders unreachable PanelContainer
 * IH4: all 3 integrations 'configured' → 3 'configured' pills, no nudge/paragraph text
 * IH5: all 3 integrations 'present-but-not-configured' → 3 nudges appear (verbatim)
 * IH6: all 3 integrations 'not-detected' → 3 paragraphs appear (verbatim)
 * IH7: mixed state: Sentry configured, Linear present-but-not-configured, Infisical not-detected
 * IH8: state pill labels exact: 'configured', 'set up needed', 'not detected'
 * IH9: not-detected Sentry paragraph contains 'SENTRY_AUTH_TOKEN' in <code>
 * IH10: not-detected Linear paragraph contains 'LINEAR_API_KEY' in <code>
 * IH11: not-detected Infisical paragraph contains 'infisical run --env=prod' in <code>
 * IH12: no <a href> anchors in DOM (D-5-20 forbids external doc links)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { IntegrationsResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useIntegrations: vi.fn(),
}))

import { useIntegrations } from '../../lib/projectQueries.js'
import { IntegrationsHealth } from './IntegrationsHealth.js'

type IntegrationsMock = Partial<UseQueryResult<IntegrationsResponse, Error>>

function mockIntegrations(overrides: IntegrationsMock = {}) {
  vi.mocked(useIntegrations).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<IntegrationsResponse, Error>)
}

const ALL_CONFIGURED: IntegrationsResponse = {
  sentry: 'configured',
  linear: 'configured',
  infisical: 'configured',
}

const ALL_PRESENT_NOT_CONFIGURED: IntegrationsResponse = {
  sentry: 'present-but-not-configured',
  linear: 'present-but-not-configured',
  infisical: 'present-but-not-configured',
}

const ALL_NOT_DETECTED: IntegrationsResponse = {
  sentry: 'not-detected',
  linear: 'not-detected',
  infisical: 'not-detected',
}

const MIXED: IntegrationsResponse = {
  sentry: 'configured',
  linear: 'present-but-not-configured',
  infisical: 'not-detected',
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('IntegrationsHealth', () => {
  it('IH1: loading state → renders Loading...', () => {
    mockIntegrations({ isLoading: true })
    render(<IntegrationsHealth projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('IH2: schema drift → renders InlineDrift with path from error message', () => {
    mockIntegrations({ error: new Error('schema_drift:/api/projects/proj-1/integrations') })
    render(<IntegrationsHealth projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Schema drift')
    expect(screen.getByText(/\/api\/projects\/proj-1\/integrations/)).toBeDefined()
  })

  it('IH3: non-drift error → renders unreachable PanelContainer', () => {
    mockIntegrations({ error: new Error('Network Error') })
    render(<IntegrationsHealth projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('IH4: all 3 integrations "configured" → 3 "configured" pills, no nudge/paragraph text', () => {
    mockIntegrations({ data: ALL_CONFIGURED })
    const { container } = render(<IntegrationsHealth projectId="proj-1" />)
    // 3 configured pills
    const configuredPills = screen.getAllByText('configured')
    expect(configuredPills.length).toBe(3)
    // No nudge or paragraph text
    expect(container.textContent).not.toContain('SENTRY_AUTH_TOKEN')
    expect(container.textContent).not.toContain('LINEAR_API_KEY')
    expect(container.textContent).not.toContain('infisical run')
  })

  it('IH5: all 3 "present-but-not-configured" → 3 "set up needed" pills + 3 verbatim nudges', () => {
    mockIntegrations({ data: ALL_PRESENT_NOT_CONFIGURED })
    const { container } = render(<IntegrationsHealth projectId="proj-1" />)
    // 3 'set up needed' pills
    const pills = screen.getAllByText('set up needed')
    expect(pills.length).toBe(3)
    // Sentry nudge verbatim per UI-SPEC line 422
    expect(container.textContent).toContain('Sentry SDK detected.')
    expect(container.textContent).toContain('SENTRY_AUTH_TOKEN')
    // Linear nudge verbatim per UI-SPEC line 423
    expect(container.textContent).toContain('Linear branch references detected.')
    expect(container.textContent).toContain('LINEAR_API_KEY')
    // Infisical nudge verbatim per UI-SPEC line 424
    expect(container.textContent).toContain('.infisical.json detected.')
    expect(container.textContent).toContain('infisical run')
  })

  it('IH6: all 3 "not-detected" → 3 "not detected" pills + 3 verbatim paragraphs', () => {
    mockIntegrations({ data: ALL_NOT_DETECTED })
    const { container } = render(<IntegrationsHealth projectId="proj-1" />)
    // D-6.1-02: panel collapses when all integrations not-detected — expand to inspect body
    fireEvent.click(screen.getByRole('button'))
    // 3 'not detected' pills
    const pills = screen.getAllByText('not detected')
    expect(pills.length).toBe(3)
    // Sentry paragraph verbatim per UI-SPEC line 425
    expect(container.textContent).toContain('Sentry surfaces recent errors and unhandled rejections inline.')
    // Linear paragraph verbatim per UI-SPEC line 426
    expect(container.textContent).toContain('Linear links commits and PRs to issue IDs.')
    // Infisical paragraph verbatim per UI-SPEC line 427
    expect(container.textContent).toContain('Infisical loads secrets from a Universal Auth project at runtime.')
  })

  it('IH7: mixed state — Sentry configured, Linear present-but-not-configured, Infisical not-detected', () => {
    mockIntegrations({ data: MIXED })
    const { container } = render(<IntegrationsHealth projectId="proj-1" />)
    // Sentry: configured pill only
    expect(screen.getByText('configured')).toBeDefined()
    // Linear: set up needed pill + nudge
    expect(screen.getByText('set up needed')).toBeDefined()
    expect(container.textContent).toContain('LINEAR_API_KEY')
    // Infisical: not detected pill + paragraph
    expect(screen.getByText('not detected')).toBeDefined()
    expect(container.textContent).toContain('Infisical loads secrets from a Universal Auth project at runtime.')
    // Sentry paragraph must NOT appear (configured, not not-detected)
    expect(container.textContent).not.toContain('Sentry surfaces recent errors')
    // Sentry nudge must NOT appear (configured, not present-but-not-configured)
    expect(container.textContent).not.toContain('Sentry SDK detected.')
  })

  it('IH8: state pill labels are exact lowercase strings per UI-SPEC line 421', () => {
    mockIntegrations({ data: MIXED })
    render(<IntegrationsHealth projectId="proj-1" />)
    expect(screen.getByText('configured')).toBeDefined()
    expect(screen.getByText('set up needed')).toBeDefined()
    expect(screen.getByText('not detected')).toBeDefined()
  })

  it('IH9: not-detected Sentry paragraph contains SENTRY_AUTH_TOKEN in <code>', () => {
    mockIntegrations({ data: ALL_NOT_DETECTED })
    const { container } = render(<IntegrationsHealth projectId="proj-1" />)
    // D-6.1-02: panel collapses when all integrations not-detected — expand to inspect body
    fireEvent.click(screen.getByRole('button'))
    const codeElements = Array.from(container.querySelectorAll('code'))
    const hasAuthToken = codeElements.some(el => el.textContent === 'SENTRY_AUTH_TOKEN')
    expect(hasAuthToken).toBe(true)
    // Also check @sentry/node is present
    const hasSentryNode = codeElements.some(el => el.textContent?.includes('@sentry/node'))
    expect(hasSentryNode).toBe(true)
  })

  it('IH10: not-detected Linear paragraph contains LINEAR_API_KEY in <code>', () => {
    mockIntegrations({ data: ALL_NOT_DETECTED })
    const { container } = render(<IntegrationsHealth projectId="proj-1" />)
    // D-6.1-02: panel collapses when all integrations not-detected — expand to inspect body
    fireEvent.click(screen.getByRole('button'))
    const codeElements = Array.from(container.querySelectorAll('code'))
    const hasLinearKey = codeElements.some(el => el.textContent === 'LINEAR_API_KEY')
    expect(hasLinearKey).toBe(true)
    // Branch name pattern present
    expect(container.textContent).toContain('donald/abc-123-fix-foo')
  })

  it('IH11: not-detected Infisical paragraph contains "infisical run --env=prod" in <code>', () => {
    mockIntegrations({ data: ALL_NOT_DETECTED })
    const { container } = render(<IntegrationsHealth projectId="proj-1" />)
    // D-6.1-02: panel collapses when all integrations not-detected — expand to inspect body
    fireEvent.click(screen.getByRole('button'))
    const codeElements = Array.from(container.querySelectorAll('code'))
    const hasInfisicalRun = codeElements.some(el =>
      el.textContent?.includes('infisical run --env=prod -- agentic-dashboard start')
    )
    expect(hasInfisicalRun).toBe(true)
  })

  it('IH12: no <a href> anchors in rendered DOM (D-5-20 forbids external doc links)', () => {
    mockIntegrations({ data: ALL_NOT_DETECTED })
    const { container } = render(<IntegrationsHealth projectId="proj-1" />)
    // D-6.1-02: panel collapses when all integrations not-detected — expand to inspect body
    fireEvent.click(screen.getByRole('button'))
    const anchors = container.querySelectorAll('a[href]')
    expect(anchors.length).toBe(0)
  })
})
