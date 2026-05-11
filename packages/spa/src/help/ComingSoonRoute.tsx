/**
 * ComingSoonRoute — parameterized wrapper around <ComingSoon section title />
 * for use as a TanStack route `component` prop.
 *
 * Plan 07-05 Task 3. Used by buildHelpRoutes for 32 stub entries.
 */
import type { ReactElement } from 'react'

import { ComingSoon } from './components/ComingSoon.js'

export interface ComingSoonRouteProps {
  section: string
  title: string
}

export function ComingSoonRoute({ section, title }: ComingSoonRouteProps): ReactElement {
  return <ComingSoon section={section} title={title} />
}
