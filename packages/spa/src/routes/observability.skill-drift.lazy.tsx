import { createLazyRoute } from '@tanstack/react-router'

import { SkillDriftPage } from '../components/panels/skill-drift/SkillDriftPage.js'

export const Route = createLazyRoute('/observability/skill-drift')({
  component: SkillDriftPage,
})
