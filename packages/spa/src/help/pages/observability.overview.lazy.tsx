/**
 * observability.overview.lazy.tsx — lazy route wrapper for /help/observability/overview.
 *
 * Plan 07-05 Task 2.
 */
import { createLazyRoute } from '@tanstack/react-router'

import { HelpPage } from '../HelpPage.js'

import ObservabilityOverviewMdx, { frontmatter } from './observability/overview.mdx'

export const Route = createLazyRoute('/_helpLayout/help/observability/overview')({
  component: () => <HelpPage FmComponent={ObservabilityOverviewMdx} frontmatter={frontmatter} />,
})
