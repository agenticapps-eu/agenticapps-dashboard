import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle.js'

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

describe('ThemeToggle', () => {
  it("renders heading 'Theme' verbatim", () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Theme')
  })

  it("renders three options: Dark / Light / Match system (verbatim labels)", () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Match system' })).toBeInTheDocument()
  })

  it('dark is selected by default (D-02) and aria-checked=true', () => {
    render(<ThemeToggle />)
    const darkRadio = screen.getByRole('radio', { name: 'Dark' })
    expect(darkRadio).toBeChecked()
    const lightRadio = screen.getByRole('radio', { name: 'Light' })
    expect(lightRadio).not.toBeChecked()
    const systemRadio = screen.getByRole('radio', { name: 'Match system' })
    expect(systemRadio).not.toBeChecked()
  })

  it("clicking 'Light' updates choice and persists to agentic-dashboard:theme", async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('radio', { name: 'Light' }))
    expect(localStorage.getItem('agentic-dashboard:theme')).toBe('light')
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
  })

  it('selected option has accent left border class', () => {
    render(<ThemeToggle />)
    // Dark is selected by default — its label should have the accent border class
    const darkLabel = screen.getByRole('radio', { name: 'Dark' }).closest('label')
    expect(darkLabel?.className).toContain('border-l-[--accent]')
  })

  it('non-selected options have transparent left border class', () => {
    render(<ThemeToggle />)
    // Light and Match system are not selected — their labels should have transparent border
    const lightLabel = screen.getByRole('radio', { name: 'Light' }).closest('label')
    expect(lightLabel?.className).toContain('border-l-transparent')
    const systemLabel = screen.getByRole('radio', { name: 'Match system' }).closest('label')
    expect(systemLabel?.className).toContain('border-l-transparent')
  })
})
