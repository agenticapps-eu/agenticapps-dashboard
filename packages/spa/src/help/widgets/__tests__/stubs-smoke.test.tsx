/**
 * Plan 07-03 Task 3 — stubs smoke test.
 *
 * Table-driven: import each of the 8 widget stub default exports, render,
 * assert the title + "Coming v1.2" badge appear. Proves Plan 07-02's
 * HelpWidget lazy() targets all resolve to renderable components.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import ApplyConsentSimulator from '../ApplyConsentSimulator.stub'
import GatePicker from '../GatePicker.stub'
import MigrationDryRun from '../MigrationDryRun.stub'
import RepoTopologyMap from '../RepoTopologyMap.stub'
import ScanReportPlayground from '../ScanReportPlayground.stub'
import SlashCommandCatalog from '../SlashCommandCatalog.stub'
import TraceVisualizer from '../TraceVisualizer.stub'
import WorkflowStateMachine from '../WorkflowStateMachine.stub'

const STUBS = [
  ['RepoTopologyMap', RepoTopologyMap, 'Repository topology map'],
  ['WorkflowStateMachine', WorkflowStateMachine, 'Workflow state machine'],
  ['GatePicker', GatePicker, 'Gate picker'],
  ['TraceVisualizer', TraceVisualizer, 'Trace visualizer'],
  ['ScanReportPlayground', ScanReportPlayground, 'Scan report playground'],
  ['ApplyConsentSimulator', ApplyConsentSimulator, 'Apply consent simulator'],
  ['MigrationDryRun', MigrationDryRun, 'Migration dry-run'],
  ['SlashCommandCatalog', SlashCommandCatalog, 'Slash command catalog'],
] as const

describe('Widget stubs smoke', () => {
  it.each(STUBS)('%s renders with the title "%s" and a Coming v1.2 badge', (_name, Component, expectedTitle) => {
    render(<Component />)
    expect(screen.getByRole('heading', { name: new RegExp(expectedTitle) })).toBeInTheDocument()
    expect(screen.getByText(/coming v1\.2/i)).toBeInTheDocument()
  })
})
