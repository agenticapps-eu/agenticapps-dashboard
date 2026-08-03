import { createLazyRoute } from '@tanstack/react-router'

import { ChangeBoardRoute } from '../components/panels/changes/ChangeBoardRoute.js'

export const Route = createLazyRoute('/changes')({
  component: ChangeBoardRoute,
})
