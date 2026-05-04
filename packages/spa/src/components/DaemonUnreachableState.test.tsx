import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DaemonUnreachableState } from './DaemonUnreachableState.js'

describe('DaemonUnreachableState', () => {
  it("renders verbatim heading 'Daemon not running'", () => {
    render(<DaemonUnreachableState agentUrl="http://127.0.0.1:5193" onRetry={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Daemon not running')
  })

  it('renders agentUrl interpolated into body', () => {
    render(<DaemonUnreachableState agentUrl="http://127.0.0.1:5193" onRetry={vi.fn()} />)
    expect(screen.getByText('http://127.0.0.1:5193')).toBeInTheDocument()
  })

  it('Try again button calls onRetry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<DaemonUnreachableState agentUrl="http://127.0.0.1:5193" onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("Try again copy is verbatim (NOT 'Retry' or 'Reload')", () => {
    render(<DaemonUnreachableState agentUrl="http://127.0.0.1:5193" onRetry={vi.fn()} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent('Try again')
    expect(btn.textContent).not.toBe('Retry')
    expect(btn.textContent).not.toBe('Reload')
  })

  it("icon uses --warning color (not --danger)", () => {
    render(<DaemonUnreachableState agentUrl="http://127.0.0.1:5193" onRetry={vi.fn()} />)
    // The AlertTriangle SVG is inside the header with className text-[--warning]
    const header = screen.getByRole('heading', { level: 2 }).closest('header')
    expect(header?.querySelector('svg')?.parentElement?.className ?? header?.className).not.toContain('--danger')
    // Confirm the section element has the warning-colored icon sibling
    const svgParent = document.querySelector('.text-\\[--warning\\]')
    expect(svgParent).not.toBeNull()
  })
})
