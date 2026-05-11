/**
 * Plan 07-02 Task 3 — ComingSoon unit tests.
 *
 * Table-driven across sections to verify the operations special-case.
 * Source: ~/Documents/.../ComingSoon.tsx
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock @tanstack/react-router Link so we can assert on `to` prop without a real router.
vi.mock('@tanstack/react-router', async (importActual) => {
  const actual = await importActual<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      to,
      children,
      className,
    }: {
      to: string
      children: React.ReactNode
      className?: string
    }) => (
      <a href={to} data-to={to} className={className}>
        {children}
      </a>
    ),
  }
})

import { ComingSoon } from './ComingSoon'

describe('ComingSoon', () => {
  it.each([
    ['workflow', 'Gates', '/help/workflow/overview'],
    ['repos', 'core repo', '/help/repos/overview'],
    ['observability', 'Scan', '/help/observability/overview'],
    ['operations', 'Update', '/help/operations/install'], // SPECIAL CASE
    ['reference', 'Glossary', '/help/reference/overview'],
  ])('section=%j title=%j back-links to %j', (section, title, expectedBackTo) => {
    render(<ComingSoon section={section} title={title} />)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    const backLink = screen.getByRole('link', { name: new RegExp(`back to ${section}`, 'i') })
    expect(backLink).toHaveAttribute('data-to', expectedBackTo)
  })

  it('renders the GitHub issues link to the project repo issues page', () => {
    render(<ComingSoon section="workflow" title="Gates" />)
    const link = screen.getByRole('link', { name: /github issues/i })
    expect(link.getAttribute('href')).toContain('agenticapps-dashboard/issues')
  })

  it('renders the Contributing link to /help/reference/contributing', () => {
    render(<ComingSoon section="workflow" title="Gates" />)
    const link = screen.getByRole('link', { name: /^contributing$/i })
    expect(link).toHaveAttribute('data-to', '/help/reference/contributing')
  })
})
