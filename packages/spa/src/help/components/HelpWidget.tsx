/**
 * HelpWidget — render slot for interactive components inside MDX pages.
 *
 * Pages reference widgets by name:
 *   <HelpWidget name="RepoTopologyMap" />
 *
 * The dispatch table maps each name to its component. v1.0 ships stubbed
 * widgets (Plan 07-03). v1.2 replaces stubs with real implementations.
 *
 * Source: ~/Documents/.../HelpWidget.tsx (translated tokens + lazy imports
 * land at ../widgets/<Name>.stub per Plan 07-03 D-7-14).
 */
import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'

const widgets = {
  // v1.0 — stubs (Plan 07-03); replace with real components in v1.2.
  RepoTopologyMap: lazy(() => import('../widgets/RepoTopologyMap.stub.js')),
  WorkflowStateMachine: lazy(() => import('../widgets/WorkflowStateMachine.stub.js')),
  GatePicker: lazy(() => import('../widgets/GatePicker.stub.js')),
  TraceVisualizer: lazy(() => import('../widgets/TraceVisualizer.stub.js')),
  ScanReportPlayground: lazy(() => import('../widgets/ScanReportPlayground.stub.js')),
  ApplyConsentSimulator: lazy(() => import('../widgets/ApplyConsentSimulator.stub.js')),
  MigrationDryRun: lazy(() => import('../widgets/MigrationDryRun.stub.js')),
  SlashCommandCatalog: lazy(() => import('../widgets/SlashCommandCatalog.stub.js')),
} as const

export type WidgetName = keyof typeof widgets

export interface HelpWidgetProps {
  name: WidgetName
}

export function HelpWidget({ name }: HelpWidgetProps): React.JSX.Element {
  const W = widgets[name]
  if (!W) {
    return (
      <div className="my-6 not-prose rounded-md border border-status-error/40 bg-status-error/10 px-4 py-3 text-sm text-status-error">
        Unknown widget: <code>{name}</code>. Add it to <code>HelpWidget.tsx</code>.
      </div>
    )
  }

  return (
    <div className="my-8 not-prose rounded-lg border border-border-subtle bg-card-bg p-1 shadow-card">
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-text-secondary">
            <Loader2 size={14} className="animate-spin" />
            Loading {name}…
          </div>
        }
      >
        <W />
      </Suspense>
    </div>
  )
}
