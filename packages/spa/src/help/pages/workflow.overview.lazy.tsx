/**
 * workflow.overview.lazy.tsx — lazy route wrapper for /help/workflow/overview.
 *
 * Plan 07-05 Task 2.
 */
import { createLazyRoute } from '@tanstack/react-router'

import { HelpPage } from '../HelpPage.js'

import WorkflowOverviewMdx, { frontmatter } from './workflow/overview.mdx'

export const Route = createLazyRoute('/help/workflow/overview')({
  component: () => <HelpPage FmComponent={WorkflowOverviewMdx} frontmatter={frontmatter} />,
})
