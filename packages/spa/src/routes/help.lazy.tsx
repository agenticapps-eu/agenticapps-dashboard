import { useEffect } from 'react'
import type React from 'react'
import { createLazyRoute } from '@tanstack/react-router'

import { PageHeader } from '../components/ui/PageHeader.js'

export const Route = createLazyRoute('/help')({
  component: HelpPage,
})

function HelpPage(): React.JSX.Element {
  useEffect(() => {
    document.title = 'AgenticApps Dashboard — Help'
  }, [])
  return (
    <div className="space-y-6">
      <PageHeader title="Help" helper="Reference and troubleshooting." />
      <section className="rounded-card bg-card-bg p-6 shadow-card">
        <h2 className="text-lg font-semibold leading-snug text-text-primary">Help</h2>
        <p className="mt-3 text-base leading-relaxed text-text-secondary">
          Detailed help arrives in Phase 6. For now, see the README at{' '}
          <code className="font-mono text-sm">github.com/agenticapps-eu/agenticapps-dashboard</code>.
        </p>
      </section>
    </div>
  )
}
