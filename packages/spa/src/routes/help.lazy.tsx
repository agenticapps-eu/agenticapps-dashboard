import { useEffect } from 'react'
import { createLazyRoute } from '@tanstack/react-router'

export const Route = createLazyRoute('/help')({
  component: HelpPage,
})

function HelpPage() {
  useEffect(() => {
    document.title = 'AgenticApps Dashboard — Help'
  }, [])
  return (
    <section className="rounded-md border border-border-subtle bg-card-bg p-6">
      <h2 className="text-xl font-semibold leading-snug text-text-primary">Help</h2>
      <p className="mt-3 text-base leading-relaxed text-text-secondary">
        Detailed help arrives in Phase 6. For now, see the README at{' '}
        <code className="font-mono text-sm">github.com/agenticapps-eu/agenticapps-dashboard</code>.
      </p>
    </section>
  )
}
