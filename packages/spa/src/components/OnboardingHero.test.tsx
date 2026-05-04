import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OnboardingHero } from './OnboardingHero.js'

describe('OnboardingHero', () => {
  it("renders headline 'One local daemon. Every device.' verbatim", () => {
    render(<OnboardingHero />)
    expect(
      screen.getByRole('heading', { name: 'One local daemon. Every device.', level: 1 }),
    ).toBeInTheDocument()
  })

  it("renders value prop 'Nothing leaves your machine.' verbatim", () => {
    render(<OnboardingHero />)
    expect(screen.getByText('Nothing leaves your machine.')).toBeInTheDocument()
  })

  it('renders three numbered step headings: Install the agent / Register and start / Click the pair URL', () => {
    render(<OnboardingHero />)
    expect(screen.getByRole('heading', { name: 'Install the agent' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Register and start' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Click the pair URL' })).toBeInTheDocument()
  })

  it('renders Step 2 with TWO CodeBlock instances (register + start)', () => {
    render(<OnboardingHero />)
    expect(
      screen.getByText('agentic-dashboard register ~/Sourcecode/your-project'),
    ).toBeInTheDocument()
    expect(screen.getByText('agentic-dashboard start')).toBeInTheDocument()
  })

  it('renders Step 3 inline pair URL example with `pages.dev/pair?...`', () => {
    const { container } = render(<OnboardingHero />)
    expect(container.innerHTML).toContain('agenticapps-dashboard.pages.dev/pair?...')
  })

  it("renders 'Why local-only →' disclosure summary verbatim (with U+2192 right arrow)", () => {
    render(<OnboardingHero />)
    // U+2192 is the right arrow character →
    const summary = screen.getByText('Why local-only →')
    expect(summary).toBeInTheDocument()
    // Verify it's exactly U+2192, not ASCII ->
    expect(summary.textContent).toBe('Why local-only →')
  })

  it('renders disclosure body mentioning .planning/ AND no telemetry', () => {
    const { container } = render(<OnboardingHero />)
    expect(container.innerHTML).toContain('.planning/')
    expect(container.innerHTML).toContain('no telemetry')
  })

  it('no <img> tags (D-01: no hero illustrations)', () => {
    const { container } = render(<OnboardingHero />)
    expect(container.querySelectorAll('img').length).toBe(0)
  })

  it('no AI-slop tells in className (D-01 + checker W3 fix)', () => {
    const { container } = render(<OnboardingHero />)
    expect(container.innerHTML).not.toMatch(
      /bg-gradient|bg-clip-text|backdrop-blur|shadow-2xl|drop-shadow/,
    )
  })

  it('uses semantic <ol role=list>', () => {
    render(<OnboardingHero />)
    expect(screen.getByRole('list')).toBeInTheDocument()
  })
})
