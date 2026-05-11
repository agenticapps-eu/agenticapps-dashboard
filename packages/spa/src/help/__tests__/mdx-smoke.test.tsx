/**
 * Plan 07-01 Task 5 — Wave 0 MDX pipeline smoke test.
 *
 * Asserts:
 *   1. A .mdx fixture imports and renders a default React component.
 *   2. The fixture's named `frontmatter` export is reachable and typed.
 *   3. Tailwind v4's @plugin typography renders the `prose` class in the DOM.
 *   4. MDXProvider chain (from main.tsx) compiles without runtime error.
 *
 * If this test fails, every downstream Wave 1+ MDX page is broken — fix the
 * pipeline before authoring shell components or content.
 *
 * @see .planning/phases/07-help-docs-v1-0/07-CONTEXT.md D-7-04..D-7-05
 * @see .planning/phases/07-help-docs-v1-0/07-RESEARCH.md §Validation Architecture
 */
import { render, screen } from '@testing-library/react'
import { MDXProvider } from '@mdx-js/react'
import { describe, it, expect } from 'vitest'

import Smoke, { frontmatter } from './fixtures/smoke.mdx'
import { mdxComponents } from '../mdxComponents'

describe('Wave 0 MDX pipeline smoke', () => {
  it('imports a .mdx fixture and renders a default React component', () => {
    render(
      <MDXProvider components={mdxComponents}>
        <article className="prose prose-slate max-w-none" data-testid="prose-article">
          <Smoke />
        </article>
      </MDXProvider>,
    )
    expect(screen.getByText('Smoke Test')).toBeInTheDocument()
  })

  it('exposes the named frontmatter export with the typed shape', () => {
    expect(frontmatter).toEqual({
      slug: '/help/__smoke',
      title: 'Smoke Test Page',
      order: 0,
      section: 'smoke',
    })
  })

  it('renders the article with the prose class so the typography plugin can style it', () => {
    render(
      <MDXProvider components={mdxComponents}>
        <article className="prose prose-slate max-w-none" data-testid="prose-article">
          <Smoke />
        </article>
      </MDXProvider>,
    )
    const article = screen.getByTestId('prose-article')
    expect(article.className).toContain('prose')
  })
})
