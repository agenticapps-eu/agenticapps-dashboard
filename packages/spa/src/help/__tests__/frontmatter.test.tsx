/**
 * Plan 07-04 Task 3 — frontmatter shape validation.
 *
 * Imports the named `frontmatter` export from each anchor MDX + shortcuts MDX
 * and asserts the shape matches what HelpLayout's breadcrumb and document.title
 * code (Plan 07-05) will read.
 *
 * @see .planning/phases/07-help-docs-v1-0/07-CONTEXT.md D-7-04 (remark-mdx-frontmatter)
 */
import { describe, it, expect } from 'vitest'

import { frontmatter as landingFm } from '../pages/landing.mdx'
import { frontmatter as obsFm } from '../pages/observability/overview.mdx'
import { frontmatter as opsFm } from '../pages/operations/install.mdx'
import { frontmatter as shortcutsFm } from '../pages/reference/shortcuts.mdx'
import { frontmatter as reposFm } from '../pages/repos/overview.mdx'
import { frontmatter as workflowFm } from '../pages/workflow/overview.mdx'

const CASES = [
  ['landing', landingFm, '/help', 'landing'],
  ['workflow/overview', workflowFm, '/help/workflow/overview', 'workflow'],
  ['repos/overview', reposFm, '/help/repos/overview', 'repos'],
  ['observability/overview', obsFm, '/help/observability/overview', 'observability'],
  ['operations/install', opsFm, '/help/operations/install', 'operations'],
  ['reference/shortcuts', shortcutsFm, '/help/reference/shortcuts', 'reference'],
] as const

describe('MDX frontmatter shape', () => {
  it.each(CASES)(
    '%s frontmatter has slug=%s section=%s and a non-empty title',
    (_name, fm, expectedSlug, expectedSection) => {
      expect(fm.slug).toBe(expectedSlug)
      expect(fm.section).toBe(expectedSection)
      expect(typeof fm.title).toBe('string')
      expect(fm.title.length).toBeGreaterThan(0)
      expect(typeof fm.order).toBe('number')
    },
  )

  it('reference/shortcuts frontmatter title is "Keyboard shortcuts" (HELP-06)', () => {
    expect(shortcutsFm.title).toBe('Keyboard shortcuts')
  })
})
