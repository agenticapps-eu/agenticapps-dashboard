import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CompatibleCoverageRow } from '@agenticapps/dashboard-shared'

import { ToastProvider } from '../../ui/Toast.js'
import { CoverageFamilySectionMobile } from './CoverageFamilySectionMobile.js'

const rows: CompatibleCoverageRow[] = [
  {
    family: 'agenticapps',
    repo: 'dashboard',
    claudeMd: { kind: 'basic', state: 'fresh' },
    workflowVersion: {
      kind: 'workflow',
      state: 'fresh',
      installedVersion: '3.0.0',
      headVersion: '3.0.0',
    },
    understand: { kind: 'basic', state: 'missing' },
    overrideCount: 1,
    overrides: [{ phaseSlug: 'phase-one', source: 'mtime' }],
  },
]

describe('CoverageFamilySectionMobile', () => {
  it('renders current cards with no retired integrations or table', () => {
    render(
      <ToastProvider>
        <CoverageFamilySectionMobile family="agenticapps" rows={rows} />
      </ToastProvider>,
    )

    expect(screen.getByText('dashboard')).toBeTruthy()
    expect(screen.getByText('CLAUDE.md')).toBeTruthy()
    expect(screen.getByText('Workflow')).toBeTruthy()
    expect(screen.getByText('Understand')).toBeTruthy()
    expect(screen.queryByText(/GitNexus/i)).toBeNull()
    expect(screen.queryByText(/^Wiki$/i)).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: /scan|refresh/i })).toBeNull()
  })
})
