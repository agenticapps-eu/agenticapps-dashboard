import { HealthResponseSchema } from '@agenticapps/dashboard-shared'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App.js'

describe('App (Phase 0 placeholder shell)', () => {
  it('renders the brand line', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/AgenticApps Dashboard/i)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/alpha/i)
  })

  it('renders the agent-version status region with empty-state copy when no agent is reachable', () => {
    render(<App />)
    const statusRegion = screen.getByTestId('agent-version')
    expect(statusRegion).toHaveTextContent(/not running/i)
    expect(statusRegion).toHaveTextContent(/Agent not running/i)
  })

  it('static fallback parses successfully against HealthResponseSchema', () => {
    const fallback = { ok: false, version: 'not running', message: 'Agent not running' }
    expect(() => HealthResponseSchema.parse(fallback)).not.toThrow()
  })
})
