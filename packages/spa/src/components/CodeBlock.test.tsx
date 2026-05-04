import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { CodeBlock } from './CodeBlock.js'

// jsdom does not implement navigator.clipboard. We install a mock on the
// Navigator prototype so that component code accessing `navigator.clipboard`
// reaches our spy. Note: @testing-library/user-event v14 intercepts clipboard
// calls via its own pointer simulation, so tests that need to verify writeText
// call count use fireEvent + act rather than userEvent.click.
let writeText: ReturnType<typeof vi.fn>

function installClipboard(resolves: boolean) {
  writeText = resolves
    ? vi.fn().mockResolvedValue(undefined)
    : vi.fn().mockRejectedValue(new Error('denied'))
  Object.defineProperty(Object.getPrototypeOf(navigator), 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  installClipboard(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CodeBlock', () => {
  it('renders the command verbatim', () => {
    render(<CodeBlock command="agentic-dashboard start" copyLabel="Copy start command" />)
    expect(screen.getByText('agentic-dashboard start')).toBeInTheDocument()
  })

  it('uses copyLabel as aria-label on the button', () => {
    render(<CodeBlock command="npx foo" copyLabel="Copy install command" />)
    expect(screen.getByRole('button', { name: 'Copy install command' })).toBeInTheDocument()
  })

  it('click writes command to clipboard', async () => {
    render(<CodeBlock command="agentic-dashboard start" copyLabel="Copy start command" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy start command' }))
    })
    expect(writeText).toHaveBeenCalledWith('agentic-dashboard start')
  })

  it('click on success shows Copied aria-live text', async () => {
    render(<CodeBlock command="agentic-dashboard start" copyLabel="Copy start command" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy start command' }))
    })
    expect(screen.getByText('Copied')).toBeInTheDocument()
  })

  it('click failure (clipboard rejected) shows role=alert with Failed to copy', async () => {
    installClipboard(false)
    render(<CodeBlock command="agentic-dashboard start" copyLabel="Copy start command" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy start command' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy.')
  })

  it('after 1500ms timeout success state reverts to idle', async () => {
    vi.useFakeTimers()
    render(<CodeBlock command="agentic-dashboard start" copyLabel="Copy start command" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy start command' }))
    })
    await act(async () => {})
    expect(screen.getByText('Copied')).toBeInTheDocument()
    await act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.queryByText('Copied')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
