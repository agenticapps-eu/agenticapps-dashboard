/**
 * reference.shortcuts.lazy.tsx — lazy route wrapper for /help/reference/shortcuts.
 *
 * HELP-06: migrated keyboard-shortcuts content from the legacy /help route.
 * Plan 07-05 Task 2.
 */
import { createLazyRoute } from '@tanstack/react-router'

import { HelpPage } from '../HelpPage.js'

import ReferenceShortcutsMdx, { frontmatter } from './reference/shortcuts.mdx'

export const Route = createLazyRoute('/_helpLayout/reference/shortcuts')({
  component: () => <HelpPage FmComponent={ReferenceShortcutsMdx} frontmatter={frontmatter} />,
})
