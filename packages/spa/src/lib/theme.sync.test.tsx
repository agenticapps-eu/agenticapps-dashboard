import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeChip } from '../components/ThemeChip.js'
import { ThemeToggle } from '../components/ThemeToggle.js'

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

/**
 * WR-01 regression: when both <ThemeChip/> (always-mounted Header) and
 * <ThemeToggle/> (Settings panel radio group) are simultaneously mounted on
 * /settings, clicking either control must update BOTH components in lockstep.
 *
 * The previous useState implementation gave each useTheme() consumer its own
 * copy of `choice`, so a click in <ThemeToggle/> didn't update <ThemeChip/>'s
 * aria-label or icon until the route remounted.
 */
describe('useTheme — shared external store keeps multiple consumers in sync (WR-01)', () => {
  it('clicking ThemeToggle radio updates ThemeChip aria-label in the same render tree', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ThemeChip />
        <ThemeToggle />
      </>,
    )
    // Default is dark — chip aria-label says "current: dark; next: light"
    const chip = screen.getByRole('button', { name: /current: dark; next: light/i })
    expect(chip).toBeInTheDocument()
    // Click the Light radio in <ThemeToggle/>
    await user.click(screen.getByRole('radio', { name: 'Light' }))
    // ThemeChip MUST now reflect the new choice
    expect(
      screen.getByRole('button', { name: /current: light; next: system/i }),
    ).toBeInTheDocument()
    // And the radio reflects the change too
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
  })

  it('clicking ThemeChip cycles updates ThemeToggle radio selection in the same render tree', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ThemeChip />
        <ThemeToggle />
      </>,
    )
    // Default dark — Dark radio is checked
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    // Click chip — cycles dark → light
    await user.click(screen.getByRole('button', { name: /current: dark/i }))
    // Light radio MUST be checked now
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Dark' })).not.toBeChecked()
  })

  it('two ThemeChips in the same tree stay in sync after either calls setChoice', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ThemeChip />
        <ThemeChip />
      </>,
    )
    const chips = screen.getAllByRole('button', { name: /current: dark/i })
    expect(chips).toHaveLength(2)
    await user.click(chips[0]!)
    // BOTH chips should now show "current: light"
    expect(screen.getAllByRole('button', { name: /current: light/i })).toHaveLength(2)
  })
})
