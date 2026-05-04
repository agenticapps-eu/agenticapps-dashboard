import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeChip } from './ThemeChip.js'

function makeMatchMedia(matches: boolean) {
  return vi.fn(() => ({
    matches,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  vi.restoreAllMocks()
  vi.stubGlobal('matchMedia', makeMatchMedia(false))
})

describe('ThemeChip', () => {
  it('renders Moon icon when theme=dark (default after localStorage.clear())', () => {
    render(<ThemeChip />)
    // Moon icon is shown for dark theme. The aria-label should indicate current: dark
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', expect.stringMatching(/current: dark/))
  })

  it('aria-label includes current and next state', () => {
    render(<ThemeChip />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/current: dark; next: light/),
    )
  })

  it('click cycles dark to light — shows Sun icon and persists to localStorage', async () => {
    const user = userEvent.setup()
    render(<ThemeChip />)
    const button = screen.getByRole('button')
    await user.click(button)
    expect(localStorage.getItem('agentic-dashboard:theme')).toBe('light')
    // After click, aria-label should show current: light
    expect(button).toHaveAttribute('aria-label', expect.stringMatching(/current: light/))
  })

  it('click from system cycles back to dark', async () => {
    const user = userEvent.setup()
    localStorage.setItem('agentic-dashboard:theme', 'system')
    render(<ThemeChip />)
    const button = screen.getByRole('button')
    // Currently system → next should be dark
    expect(button).toHaveAttribute('aria-label', expect.stringMatching(/current: system; next: dark/))
    await user.click(button)
    expect(localStorage.getItem('agentic-dashboard:theme')).toBe('dark')
    expect(button).toHaveAttribute('aria-label', expect.stringMatching(/current: dark/))
  })
})
