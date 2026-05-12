/**
 * Plan 07-04 Task 6 — reference/shortcuts.mdx render test.
 *
 * HELP-06: the old /help keyboard-shortcuts content lives at this MDX page,
 * rendering the KbdHint chips. Validate the migration content-for-content.
 */
import { MDXProvider } from '@mdx-js/react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { mdxComponents } from '../mdxComponents'
import ShortcutsPage from '../pages/reference/shortcuts.mdx'

describe('reference/shortcuts.mdx (HELP-06)', () => {
  it('renders the page heading', () => {
    render(
      <MDXProvider components={mdxComponents}>
        <article className="prose">
          <ShortcutsPage />
        </article>
      </MDXProvider>,
    )
    expect(screen.getByRole('heading', { name: /Keyboard shortcuts/i, level: 1 })).toBeInTheDocument()
  })

  it('renders all four canonical shortcut keys (R, ?, /, Cmd+K)', () => {
    render(
      <MDXProvider components={mdxComponents}>
        <article className="prose">
          <ShortcutsPage />
        </article>
      </MDXProvider>,
    )
    expect(screen.getAllByText('R').length).toBeGreaterThan(0)
    expect(screen.getAllByText('?').length).toBeGreaterThan(0)
    expect(screen.getAllByText('/').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cmd').length).toBeGreaterThan(0)
    expect(screen.getAllByText('K').length).toBeGreaterThan(0)
  })

  it('renders the "Refresh" action description for the R shortcut', () => {
    render(
      <MDXProvider components={mdxComponents}>
        <article className="prose">
          <ShortcutsPage />
        </article>
      </MDXProvider>,
    )
    expect(screen.getByText(/refresh the current view/i)).toBeInTheDocument()
  })

  it('renders the GFM table (remark-gfm proves operational)', () => {
    const { container } = render(
      <MDXProvider components={mdxComponents}>
        <article className="prose">
          <ShortcutsPage />
        </article>
      </MDXProvider>,
    )
    expect(container.querySelector('table')).toBeInTheDocument()
  })
})
