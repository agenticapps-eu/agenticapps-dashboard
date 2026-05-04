import { useEffect } from 'react'
import { createLazyRoute } from '@tanstack/react-router'

import { OnboardingHero } from '../components/OnboardingHero.js'

export const Route = createLazyRoute('/onboarding')({
  component: OnboardingPage,
})

function OnboardingPage() {
  useEffect(() => {
    document.title = 'AgenticApps Dashboard — Onboarding'
  }, [])
  return <OnboardingHero />
}
