/**
 * HelpLayout.dark.test.tsx — the docs body follows the appearance.
 *
 * The typography plugin's `prose-slate` is not driven by tokens.css, so it is
 * the one surface a `.dark` block cannot repaint. It needs `dark:prose-invert`
 * to follow the appearance, and that modifier has been removed once already:
 * Phase 7 dropped it because lib/theme.ts puts `dark` on <html> by default
 * (D-02) while no dark palette existed, so inverted prose rendered white on warm
 * paper. That removal was right then and is wrong now — with dark surfaces and
 * no modifier, the docs render dark prose on a dark ground.
 *
 * This asserts the pairing stays coupled, so removing either half fails loudly
 * instead of silently making the documentation unreadable in the default
 * appearance.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HelpLayout } from './HelpLayout.js'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  Outlet: () => <p>documentation body</p>,
  useRouterState: () => '/help/workflow/overview',
}))

describe('HelpLayout in the dark appearance', () => {
  it('inverts its prose so the docs body follows the appearance', () => {
    render(<HelpLayout />)
    const article = screen.getByText('documentation body').closest('article')
    expect(article).not.toBeNull()
    expect(article?.className).toContain('dark:prose-invert')
  })
})
