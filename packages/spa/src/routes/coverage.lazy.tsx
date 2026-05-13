import { createLazyRoute } from '@tanstack/react-router'

import { CoveragePage } from '../components/panels/coverage/CoveragePage.js'

export const Route = createLazyRoute('/coverage')({
  component: CoveragePage,
})
