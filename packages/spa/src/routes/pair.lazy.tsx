import { createLazyRoute } from '@tanstack/react-router'

// TODO Plan 04: pair — replace with /pair?agent=&token= validate + save flow
export const Route = createLazyRoute('/pair')({
  component: () => <p>TODO Plan 04: pair placeholder</p>,
})
