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
      <div>
        <PageHeader title="Settings" />
        {/* D-6.1-01: helper prose rendered separately so we can cap at 75ch.
            PageHeader.helper accepts string only and renders without max-w. */}
        <p className="mt-2 max-w-[75ch] text-base text-text-secondary">
          Pair the daemon and configure the dashboard.
        </p>
      </div>
      <ManualPairForm />
      <ThemeToggle />
    </div>
  )
}
