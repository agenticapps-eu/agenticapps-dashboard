import { useEffect } from 'react'
import type React from 'react'
import { createLazyRoute } from '@tanstack/react-router'

import { ManualPairForm } from '../components/ManualPairForm.js'
import { ThemeToggle } from '../components/ThemeToggle.js'
import { PageHeader } from '../components/ui/PageHeader.js'

export const Route = createLazyRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage(): React.JSX.Element {
  useEffect(() => {
    document.title = 'AgenticApps Dashboard — Settings'
  }, [])
  return (
    <div className="space-y-12">
      <PageHeader title="Settings" helper="Pair the daemon and configure the dashboard." />
      <ManualPairForm />
      <ThemeToggle />
    </div>
  )
}
