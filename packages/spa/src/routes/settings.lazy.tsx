import { useEffect } from 'react'
import { createLazyRoute } from '@tanstack/react-router'
import { ManualPairForm } from '../components/ManualPairForm.js'
import { ThemeToggle } from '../components/ThemeToggle.js'

export const Route = createLazyRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  useEffect(() => {
    document.title = 'AgenticApps Dashboard — Settings'
  }, [])
  return (
    <div className="space-y-12">
      <ManualPairForm />
      <ThemeToggle />
    </div>
  )
}
