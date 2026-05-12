/**
 * repos.overview.lazy.tsx — lazy route wrapper for /help/repos/overview.
 *
 * Plan 07-05 Task 2.
 */
import { createLazyRoute } from '@tanstack/react-router'

import { HelpPage } from '../HelpPage.js'

import ReposOverviewMdx, { frontmatter } from './repos/overview.mdx'

export const Route = createLazyRoute('/help/repos/overview')({
  component: () => <HelpPage FmComponent={ReposOverviewMdx} frontmatter={frontmatter} />,
})
