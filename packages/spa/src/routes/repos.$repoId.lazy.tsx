import { createLazyRoute } from '@tanstack/react-router'

import { RepoDetailPage } from '../components/panels/readiness/RepoDetailPage.js'

export const Route = createLazyRoute('/repos/$repoId')({
  component: RepoDetailPage,
})
