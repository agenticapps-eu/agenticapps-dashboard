/**
 * landing.lazy.tsx — lazy route wrapper for /help (index landing).
 *
 * Plan 07-05 Task 2.
 */
import { createLazyRoute } from '@tanstack/react-router'

import { HelpPage } from '../HelpPage.js'

import LandingMdx, { frontmatter } from './landing.mdx'

export const Route = createLazyRoute('/_helpLayout/')({
  component: () => <HelpPage FmComponent={LandingMdx} frontmatter={frontmatter} />,
})
