/**
 * operations.install.lazy.tsx — lazy route wrapper for /help/operations/install.
 *
 * Plan 07-05 Task 2.
 */
import { createLazyRoute } from '@tanstack/react-router'

import { HelpPage } from '../HelpPage.js'

import OperationsInstallMdx, { frontmatter } from './operations/install.mdx'

export const Route = createLazyRoute('/_helpLayout/help/operations/install')({
  component: () => <HelpPage FmComponent={OperationsInstallMdx} frontmatter={frontmatter} />,
})
