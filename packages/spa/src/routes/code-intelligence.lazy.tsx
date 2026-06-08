import { createLazyRoute } from '@tanstack/react-router'

import { CodeIntelligencePage } from '../components/panels/code-intelligence/CodeIntelligencePage.js'

export const Route = createLazyRoute('/code-intelligence')({
  component: CodeIntelligencePage,
})
