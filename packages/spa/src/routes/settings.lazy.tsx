import { createLazyRoute } from '@tanstack/react-router'

// TODO Plan 05: settings — replace with manual pair form + theme toggle
export const Route = createLazyRoute('/settings')({
  component: () => <p>TODO Plan 05: settings placeholder</p>,
})
