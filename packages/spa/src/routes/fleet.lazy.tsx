import { createLazyRoute } from '@tanstack/react-router'

import { FleetPage } from '../components/panels/readiness/FleetPage.js'

export const Route = createLazyRoute('/fleet')({
  component: FleetPage,
})
