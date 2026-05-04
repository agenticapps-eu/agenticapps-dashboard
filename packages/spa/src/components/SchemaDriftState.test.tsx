import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SchemaDriftState } from './SchemaDriftState.js'

const FIRST_ISSUE = { path: 'foo.bar', expected: 'number', got: 'undefined' }
const FULL_ISSUES = [{ code: 'invalid_type', path: ['foo', 'bar'], message: 'Expected number, received undefined' }]

describe('SchemaDriftState', () => {
  it("renders verbatim heading 'Schema drift detected'", () => {
    render(<SchemaDriftState firstIssue={FIRST_ISSUE} fullIssues={[]} onRetry={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Schema drift detected')
  })

  it('renders verbatim body about agent and dashboard disagreeing', () => {
    render(<SchemaDriftState firstIssue={FIRST_ISSUE} fullIssues={[]} onRetry={vi.fn()} />)
    expect(
      screen.getByText(/The agent and dashboard disagree on the shape of this response/),
    ).toBeInTheDocument()
  })

  it('renders firstIssue field/expected/got verbatim', () => {
    render(<SchemaDriftState firstIssue={FIRST_ISSUE} fullIssues={[]} onRetry={vi.fn()} />)
    expect(screen.getByText('foo.bar')).toBeInTheDocument()
    expect(screen.getByText('number')).toBeInTheDocument()
    expect(screen.getByText('undefined')).toBeInTheDocument()
  })

  it('Show full diff disclosure renders fullIssues JSON', async () => {
    const user = userEvent.setup()
    render(
      <SchemaDriftState firstIssue={FIRST_ISSUE} fullIssues={FULL_ISSUES as never} onRetry={vi.fn()} />,
    )
    const summary = screen.getByText('Show full diff')
    await user.click(summary)
    const pre = screen.getByRole('group').querySelector('pre') ?? document.querySelector('pre')
    expect(pre?.textContent).toContain('invalid_type')
  })

  it('Retry request button calls onRetry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<SchemaDriftState firstIssue={FIRST_ISSUE} fullIssues={[]} onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: /retry request/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("Retry request button copy is verbatim 'Retry request' (NOT 'Reload' or 'Retry')", () => {
    render(<SchemaDriftState firstIssue={FIRST_ISSUE} fullIssues={[]} onRetry={vi.fn()} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent('Retry request')
    expect(btn.textContent).not.toBe('Retry')
    expect(btn.textContent).not.toBe('Reload')
  })
})
