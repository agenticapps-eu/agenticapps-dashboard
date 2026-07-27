import { useState, type ReactElement } from 'react'
import { Boxes, FlaskConical, GitCompareArrows } from 'lucide-react'
import type {
  WorkflowHarnessRequest,
  WorkflowHarnessResult,
  WorkflowResponse,
} from '@agenticapps/dashboard-shared'

import {
  useRunWorkflowHarness,
  useWorkflow,
  useWorkflowHarnessResults,
} from '../../lib/workflowQueries.js'
import { SchemaDriftState } from '../SchemaDriftState.js'
import { Card } from '../ui/Card.js'
import { CardHeader } from '../ui/CardHeader.js'
import { PageHeader } from '../ui/PageHeader.js'

type WorkflowHost = WorkflowResponse['hosts'][number]
type WorkflowArtifact = WorkflowHost['artifacts'][number]
type WorkflowHarnessId = WorkflowHarnessRequest['harnessId']

const ARTIFACT_ROWS: ReadonlyArray<{
  id: WorkflowArtifact['artifactId']
  label: string
}> = [
  { id: 'change-gate', label: 'Change gate' },
  { id: 'reviewer-cli', label: 'Reviewer CLI' },
  { id: 'change-gate-harness', label: 'Change gate harness' },
  { id: 'reviewer-cli-harness', label: 'Reviewer CLI harness' },
]

const HARNESS_ROWS: ReadonlyArray<{
  id: WorkflowHarnessId
  label: string
  buttonLabel: string
}> = [
  {
    id: 'change-gate',
    label: 'Gate harness',
    buttonLabel: 'Run change gate',
  },
  {
    id: 'reviewer-cli',
    label: 'Reviewer harness',
    buttonLabel: 'Run reviewer CLI',
  },
]

const ROOT_LABELS: Record<WorkflowResponse['machineRoots'][number]['rootId'], string> = {
  'agenticapps-bin': 'Machine-wide tools',
  'claude-skills': 'Claude skills',
  'codex-skills': 'Codex skills',
  'opencode-skills': 'OpenCode skills',
  'pi-skills': 'Pi skills',
}

function stateTextClass(
  state:
    | WorkflowHost['coreState']
    | WorkflowArtifact['state']
    | WorkflowArtifact['provenance']['state']
    | 'present'
    | 'absent',
): string {
  switch (state) {
    case 'current':
    case 'identical':
    case 'valid':
    case 'present':
      return 'text-status-success'
    case 'behind':
    case 'ahead':
    case 'divergent':
    case 'invalid':
      return 'text-status-warning'
    case 'missing':
      return 'text-status-error'
    default:
      return 'text-text-tertiary'
  }
}

function capitalized(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function reasonLabel(value: string): string {
  return value.replaceAll('-', ' ')
}

function artifactFor(
  host: WorkflowHost,
  artifactId: WorkflowArtifact['artifactId'],
): WorkflowArtifact | undefined {
  return host.artifacts.find((artifact) => artifact.artifactId === artifactId)
}

function provenanceState(
  host: WorkflowHost,
): WorkflowArtifact['provenance']['state'] | 'unavailable' {
  const states = host.artifacts.map(({ provenance }) => provenance.state)
  if (states.length === 0) return 'unavailable'
  if (states.includes('invalid')) return 'invalid'
  if (states.includes('absent')) return 'absent'
  return 'valid'
}

function formatAge(ageMs: number): string {
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1_000)}s ago`
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m ago`
  return `${Math.floor(ageMs / 3_600_000)}h ago`
}

function resultLabel(result: WorkflowHarnessResult): string {
  if (result.state === 'completed') {
    return `${result.passed ? 'Passed' : 'Failed'} · ${formatAge(result.ageMs)}`
  }
  const detail = result.reason ? ` · ${reasonLabel(result.reason)}` : ''
  if (result.state === 'busy') return `Busy${detail}`
  if (result.state === 'refused') return `Refused${detail}`
  if (result.state === 'timeout') return `Timed out${detail}`
  return `Bound exceeded${detail}`
}

function resultClass(result: WorkflowHarnessResult): string {
  if (result.state !== 'completed') return 'text-status-warning'
  return result.passed ? 'text-status-success' : 'text-status-error'
}

function LoadingState(): ReactElement {
  return (
    <div aria-label="Loading workflow fleet" className="grid gap-6">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-40 animate-pulse rounded-card bg-card-bg shadow-card" />
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }): ReactElement {
  return (
    <section role="status" className="rounded-card bg-card-bg p-6 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">Could not load workflow data.</h2>
      <p className="mt-2 text-sm text-text-tertiary">
        Check that the dashboard agent is available, then try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md border border-border-subtle bg-card-bg-hover px-4 py-2 text-sm font-semibold text-text-primary hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Retry
      </button>
    </section>
  )
}

function SpecConformance({ data }: { data: WorkflowResponse }): ReactElement {
  const coreVersion = data.core.specVersion ?? 'Unavailable'
  return (
    <Card ariaLabelledBy="workflow-spec-heading">
      <CardHeader
        icon={<GitCompareArrows size={16} aria-hidden="true" />}
        label="Spec conformance"
        titleId="workflow-spec-heading"
        helper={`Core spec ${coreVersion}`}
      />
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Workflow spec conformance matrix"
        tabIndex={0}
      >
        <table className="min-w-[760px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-tertiary">
              <th className="sticky left-0 bg-card-bg py-3 pr-5 font-medium">Host</th>
              <th className="px-3 py-3 font-medium">Primary skill</th>
              <th className="px-3 py-3 font-medium">Skill range</th>
              <th className="px-3 py-3 font-medium">Migration position</th>
            </tr>
          </thead>
          <tbody>
            {data.hosts.map((host) => (
              <tr key={host.hostId} className="border-b border-border-subtle last:border-b-0">
                <th className="sticky left-0 bg-card-bg py-4 pr-5 font-mono text-xs font-semibold text-text-primary">
                  {host.hostId}
                </th>
                <td className="px-3 py-4">
                  <span className="tabular-nums text-text-primary">
                    {host.primary?.version ?? 'Unknown'}
                  </span>
                  <span className={`ml-2 text-xs font-medium ${stateTextClass(host.coreState)}`}>
                    {capitalized(host.coreState)}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <span className="tabular-nums text-text-primary">
                    {host.minimum && host.maximum ? `${host.minimum}–${host.maximum}` : 'Unknown'}
                  </span>
                  {host.state === 'missing' ? (
                    <span className="ml-2 text-xs text-status-error">
                      Missing repository
                    </span>
                  ) : host.unknowns.length > 0 ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-status-warning focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {host.unknowns.length} unknown
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-text-tertiary">
                        {host.unknowns.map((skill) => (
                          <li key={skill.id}>
                            {skill.name} ·{' '}
                            {reasonLabel(skill.reason ?? 'unknown')}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : host.laggards.length > 0 ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-status-warning focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {host.laggards.length} {host.laggards.length === 1 ? 'laggard' : 'laggards'}
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-text-tertiary">
                        {host.laggards.map((laggard) => (
                          <li key={laggard.id}>
                            {laggard.name} · {laggard.version}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : host.internallyConsistent ? (
                    <span className="ml-2 text-xs text-status-success">
                      Aligned
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-status-warning">
                      Drift detected
                    </span>
                  )}
                </td>
                <td className="px-3 py-4 tabular-nums text-text-secondary">
                  {host.migration.highest ? `Offered ${host.migration.highest}` : 'None offered'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function SharedArtifacts({ data }: { data: WorkflowResponse }): ReactElement {
  const machineTools = data.machineRoots.find(({ rootId }) => rootId === 'agenticapps-bin')

  return (
    <Card ariaLabelledBy="workflow-artifacts-heading">
      <CardHeader
        icon={<Boxes size={16} aria-hidden="true" />}
        label="Shared artefacts"
        titleId="workflow-artifacts-heading"
        helper="Byte identity and recorded provenance"
      />
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Shared workflow artefact matrix"
        tabIndex={0}
      >
        <table className="min-w-[900px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-tertiary">
              <th className="sticky left-0 bg-card-bg py-3 pr-5 font-medium">Artefact</th>
              {data.hosts.map((host) => (
                <th key={host.hostId} className="px-3 py-3 font-mono text-[11px] font-medium">
                  {host.hostId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ARTIFACT_ROWS.map((row) => (
              <tr key={row.id} className="border-b border-border-subtle">
                <th className="sticky left-0 bg-card-bg py-4 pr-5 font-medium text-text-primary">
                  {row.label}
                </th>
                {data.hosts.map((host) => {
                  const artifact = artifactFor(host, row.id)
                  return (
                    <td key={host.hostId} className="px-3 py-4">
                      {artifact ? (
                        <div className="flex flex-col gap-1">
                          {artifact.marker.version && (
                            <span className="tabular-nums text-text-primary">
                              {artifact.marker.version}
                            </span>
                          )}
                          <span className={`text-xs font-medium ${stateTextClass(artifact.state)}`}>
                            {capitalized(artifact.state)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-tertiary">Unavailable</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="border-b border-border-subtle">
              <th className="sticky left-0 bg-card-bg py-4 pr-5 font-medium text-text-primary">
                Vendor provenance
              </th>
              {data.hosts.map((host) => {
                const state = provenanceState(host)
                return (
                  <td
                    key={host.hostId}
                    className={`px-3 py-4 text-xs font-medium ${stateTextClass(state)}`}
                  >
                    {capitalized(state)}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th className="sticky left-0 bg-card-bg py-4 pr-5 font-medium text-text-primary">
                Machine-wide tools
              </th>
              <td className="px-3 py-4" colSpan={4}>
                {machineTools?.state === 'present' ? (
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {machineTools.entries.map((entry) => (
                      <span key={entry.id} className="text-xs text-text-secondary">
                        {entry.id}
                        {entry.artifact?.marker.version
                          ? ` · ${entry.artifact.marker.version}`
                          : ''}
                        {` · ${capitalized(entry.artifact?.state ?? entry.state)}`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-text-tertiary">Absent</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Machine skill roots">
        {data.machineRoots
          .filter(({ rootId }) => rootId !== 'agenticapps-bin')
          .map((root) => (
            <span
              key={root.rootId}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-xs text-text-secondary"
            >
              <span>
                {ROOT_LABELS[root.rootId]} · {capitalized(root.state)}
              </span>
              {root.entries.map((entry) => (
                <span
                  key={entry.id}
                  className={
                    entry.state === 'missing'
                      ? 'text-status-error'
                      : 'text-status-success'
                  }
                >
                  {entry.id} · {capitalized(entry.state)}
                </span>
              ))}
            </span>
          ))}
      </div>
    </Card>
  )
}

interface HarnessResultsProps {
  hosts: WorkflowResponse['hosts']
  results: Readonly<Record<string, WorkflowHarnessResult | undefined>>
  attempts: Readonly<Record<string, WorkflowHarnessResult | undefined>>
  errors: Readonly<Record<string, boolean | undefined>>
  runningKey: string | null
  onRun: (request: WorkflowHarnessRequest) => void
}

function HarnessResults({
  hosts,
  results,
  attempts,
  errors,
  runningKey,
  onRun,
}: HarnessResultsProps): ReactElement {
  return (
    <Card ariaLabelledBy="workflow-harness-heading">
      <CardHeader
        icon={<FlaskConical size={16} aria-hidden="true" />}
        label="Harness results"
        titleId="workflow-harness-heading"
        helper="Runs only when requested"
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {hosts.map((host) => (
          <article key={host.hostId} className="rounded-lg border border-border-subtle p-4">
            <h3 className="font-mono text-xs font-semibold text-text-primary">{host.hostId}</h3>
            <div className="mt-3 grid gap-3">
              {HARNESS_ROWS.map((harness) => {
                const key = `${host.hostId}:${harness.id}`
                const result = results[key]
                const attempt = attempts[key]
                const diagnosticOutput = attempt?.output || result?.output
                const running = runningKey === key
                return (
                  <div key={harness.id} className="rounded-md bg-app-bg p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary">{harness.label}</p>
                        {result ? (
                          <p className={`mt-1 text-xs font-semibold ${resultClass(result)}`}>
                            {resultLabel(result)}
                          </p>
                        ) : errors[key] ? (
                          <p className="mt-1 text-xs font-semibold text-status-error">
                            Request failed
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-text-tertiary">No current result</p>
                        )}
                        {attempt && (
                          <p
                            className={`mt-1 text-xs font-semibold ${resultClass(attempt)}`}
                          >
                            {resultLabel(attempt)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={runningKey !== null || host.state !== 'available'}
                        aria-busy={running || undefined}
                        onClick={() =>
                          onRun({
                            hostId: host.hostId,
                            harnessId: harness.id,
                          })
                        }
                        className="min-h-11 shrink-0 rounded-md border border-border-subtle bg-card-bg-hover px-4 py-2 text-sm font-semibold text-text-primary hover:bg-card-bg disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-label={`${harness.buttonLabel} for ${host.hostId}`}
                      >
                        {running ? 'Running…' : harness.buttonLabel}
                      </button>
                    </div>
                    {diagnosticOutput && (
                      <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle bg-card-bg p-3 text-xs text-text-secondary">
                        {diagnosticOutput}
                      </pre>
                    )}
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </Card>
  )
}

export function WorkflowPage(): ReactElement {
  const workflow = useWorkflow()
  const cachedHarnessResults = useWorkflowHarnessResults()
  const harness = useRunWorkflowHarness()
  const [results, setResults] = useState<Record<string, WorkflowHarnessResult | undefined>>({})
  const [attempts, setAttempts] = useState<Record<string, WorkflowHarnessResult | undefined>>({})
  const [errors, setErrors] = useState<Record<string, boolean | undefined>>({})
  const [runningKey, setRunningKey] = useState<string | null>(null)

  const runHarness = (request: WorkflowHarnessRequest): void => {
    const key = `${request.hostId}:${request.harnessId}`
    setRunningKey(key)
    setErrors((current) => ({ ...current, [key]: false }))
    void harness
      .mutateAsync(request)
      .then((result) => {
        if (result.state === 'completed') {
          setResults((current) => ({ ...current, [key]: result }))
          setAttempts((current) => ({ ...current, [key]: undefined }))
        } else {
          setAttempts((current) => ({ ...current, [key]: result }))
        }
      })
      .catch(() => {
        setErrors((current) => ({ ...current, [key]: true }))
      })
      .finally(() => {
        setRunningKey(null)
      })
  }

  let content: ReactElement
  if (workflow.error?.message.startsWith('schema_drift:')) {
    content = (
      <SchemaDriftState
        firstIssue={{
          path: workflow.error.message.slice('schema_drift:'.length),
          expected: 'see schema',
          got: 'mismatch',
        }}
        fullIssues={[]}
        onRetry={() => void workflow.refetch()}
      />
    )
  } else if (workflow.isPending) {
    content = <LoadingState />
  } else if (workflow.isError || !workflow.data) {
    content = <ErrorState onRetry={() => void workflow.refetch()} />
  } else {
    const hydratedResults = Object.fromEntries(
      (cachedHarnessResults.data ?? []).map((result) => [
        `${result.hostId}:${result.harnessId}`,
        result,
      ]),
    )
    content = (
      <>
        <SpecConformance data={workflow.data} />
        <SharedArtifacts data={workflow.data} />
        <HarnessResults
          hosts={workflow.data.hosts}
          results={{ ...hydratedResults, ...results }}
          attempts={attempts}
          errors={errors}
          runningKey={runningKey}
          onRun={runHarness}
        />
      </>
    )
  }

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Workflow fleet"
        helper="Versions, shared artefacts, and manual conformance checks for the five workflow repositories."
        sticky={true}
      />
      {content}
    </main>
  )
}
