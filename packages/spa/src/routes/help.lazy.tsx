import { useEffect } from 'react'
import type React from 'react'
import { createLazyRoute } from '@tanstack/react-router'

import { KbdHint } from '../components/ui/KbdHint.js'
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
          See the README at{' '}
          <code className="font-mono text-sm">github.com/agenticapps-eu/agenticapps-dashboard</code>{' '}
          for full documentation.
        </p>
      </section>
      <section className="rounded-card bg-card-bg p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary mb-3">Keyboard shortcuts</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-border-subtle">
              <td className="py-2 w-24"><KbdHint keys="R" /></td>
              <td className="py-2 text-text-secondary">Refresh the current view's data</td>
            </tr>
            <tr className="border-b border-border-subtle">
              <td className="py-2"><KbdHint keys="?" /></td>
              <td className="py-2 text-text-secondary">Open this help page</td>
            </tr>
            <tr className="border-b border-border-subtle">
              <td className="py-2"><KbdHint keys="/" /></td>
              <td className="py-2 text-text-secondary">Focus the search box (home only)</td>
            </tr>
            <tr>
              <td className="py-2">
                <span className="inline-flex items-center gap-1">
                  <KbdHint keys="Cmd" /> <span className="text-text-secondary">+</span> <KbdHint keys="K" />
                </span>
              </td>
              <td className="py-2 text-text-secondary">Open the command palette</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
