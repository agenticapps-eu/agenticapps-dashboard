import { createLazyRoute } from '@tanstack/react-router'

import { WorkflowPage } from '../components/workflow/WorkflowPage.js'

export const Route = createLazyRoute('/workflow')({
  component: WorkflowPage,
})
