/**
 * Plan 07-02 Task 4 — HelpWidget unit tests.
 *
 * R2 resolution: Plan 07-03 owns ../widgets/*.stub files. This test mocks the
 * 8 lazy imports so the test runs in parallel with 07-03 (or before 07-03
 * lands physical files).
 *
 * Source: ~/Documents/.../HelpWidget.tsx
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock all 8 widget stubs that HelpWidget imports lazily.
vi.mock('../widgets/RepoTopologyMap.stub', () => ({
  default: () => <div data-testid="stub-RepoTopologyMap">RepoTopologyMap stub</div>,
}))
vi.mock('../widgets/WorkflowStateMachine.stub', () => ({
  default: () => <div data-testid="stub-WorkflowStateMachine">WorkflowStateMachine stub</div>,
}))
vi.mock('../widgets/GatePicker.stub', () => ({
  default: () => <div data-testid="stub-GatePicker">GatePicker stub</div>,
}))
vi.mock('../widgets/TraceVisualizer.stub', () => ({
  default: () => <div data-testid="stub-TraceVisualizer">TraceVisualizer stub</div>,
}))
vi.mock('../widgets/ScanReportPlayground.stub', () => ({
  default: () => <div data-testid="stub-ScanReportPlayground">ScanReportPlayground stub</div>,
}))
vi.mock('../widgets/ApplyConsentSimulator.stub', () => ({
  default: () => <div data-testid="stub-ApplyConsentSimulator">ApplyConsentSimulator stub</div>,
}))
vi.mock('../widgets/MigrationDryRun.stub', () => ({
  default: () => <div data-testid="stub-MigrationDryRun">MigrationDryRun stub</div>,
}))
vi.mock('../widgets/SlashCommandCatalog.stub', () => ({
  default: () => <div data-testid="stub-SlashCommandCatalog">SlashCommandCatalog stub</div>,
}))

import { HelpWidget } from './HelpWidget'

const KNOWN_NAMES = [
  'RepoTopologyMap',
  'WorkflowStateMachine',
  'GatePicker',
  'TraceVisualizer',
  'ScanReportPlayground',
  'ApplyConsentSimulator',
  'MigrationDryRun',
  'SlashCommandCatalog',
] as const

describe('HelpWidget', () => {
  it.each(KNOWN_NAMES)('dispatches known widget %s via React.lazy', async (name) => {
    // Cast: WidgetName is the union of KNOWN_NAMES — TypeScript narrows in source code.
    render(<HelpWidget name={name as never} />)
    await waitFor(() => {
      expect(screen.getByTestId(`stub-${name}`)).toBeInTheDocument()
    })
  })

  it('renders bordered error for an unknown widget name', () => {
    // @ts-expect-error - intentionally passing a name outside the WidgetName union to exercise the runtime branch
    render(<HelpWidget name={'NotARealWidget'} />)
    expect(screen.getByText(/unknown widget/i)).toBeInTheDocument()
    const code = screen.getByText('NotARealWidget', { selector: 'code' })
    expect(code).toBeInTheDocument()
  })

  it('wraps known widget in not-prose container so MDX prose styles do not bleed in', async () => {
    const { container } = render(<HelpWidget name={'RepoTopologyMap' as never} />)
    await waitFor(() => {
      expect(screen.getByTestId('stub-RepoTopologyMap')).toBeInTheDocument()
    })
    // The outermost wrapper has not-prose
    expect(container.querySelector('.not-prose')).toBeInTheDocument()
  })
})
