/**
 * Plan 07-02 Task 2 — HelpHook unit tests.
 *
 * Source: ~/Documents/.../HelpHook.tsx
 * @see .planning/phases/07-help-docs-v1-0/07-CONTEXT.md D-7-15
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

import { HelpHook } from './HelpHook'

describe('HelpHook', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it('renders a button with the default "Learn more" aria-label', () => {
    render(<HelpHook topic="workflow.gates" />)
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument()
  })

  it('uses the provided label override on aria-label', () => {
    render(<HelpHook topic="workflow.gates" label="What's a gate?" />)
    expect(screen.getByRole('button', { name: "What's a gate?" })).toBeInTheDocument()
  })

  it('shows tooltip on hover and hides on unhover', async () => {
    const user = userEvent.setup()
    render(<HelpHook topic="workflow.gates" label="Click me" />)
    const btn = screen.getByRole('button')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await user.hover(btn)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Click me')
    await user.unhover(btn)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows tooltip on focus and hides on blur', async () => {
    const user = userEvent.setup()
    render(<HelpHook topic="workflow.gates" />)
    const btn = screen.getByRole('button')
    btn.focus()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    await user.tab() // blur
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('navigates to topicToUrl(topic) on click', async () => {
    const user = userEvent.setup()
    render(<HelpHook topic="observability.scan#high-confidence" />)
    await user.click(screen.getByRole('button'))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/help/observability/scan#high-confidence',
    })
  })

  it('with panel=true, console.warns AND still navigates (v1.0 fall-through)', async () => {
    const user = userEvent.setup()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<HelpHook topic="workflow.gates" panel={true} />)
    await user.click(screen.getByRole('button'))
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('HelpHook panel mode not yet implemented'),
    )
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/help/workflow/gates' })
    warnSpy.mockRestore()
  })
})
