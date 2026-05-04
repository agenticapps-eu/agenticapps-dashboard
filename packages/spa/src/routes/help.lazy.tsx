import { createLazyRoute } from '@tanstack/react-router'

// TODO Plan 05: help — replace with help content
export const Route = createLazyRoute('/help')({
  component: () => <p>TODO Plan 05: help placeholder</p>,
})
