import { CodeBlock } from './CodeBlock.js'

export function OnboardingHero() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-8 md:pt-16">
      <header>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[--text]">
          One local daemon. Every device.
        </h1>
        <p className="mt-2 text-base leading-relaxed text-[--text-muted]">
          Nothing leaves your machine.
        </p>
      </header>

      <ol className="mt-12 space-y-8" role="list">
        <li className="grid grid-cols-[40px_1fr] gap-4">
          <div className="flex aspect-square w-8 items-center justify-center rounded-full bg-[--surface-elevated] text-sm font-semibold text-[--text]">
            1
          </div>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[--text]">Install the agent</h2>
            <CodeBlock
              command="npx @agenticapps/dashboard-agent"
              copyLabel="Copy install command"
            />
          </div>
        </li>

        <li className="grid grid-cols-[40px_1fr] gap-4">
          <div className="flex aspect-square w-8 items-center justify-center rounded-full bg-[--surface-elevated] text-sm font-semibold text-[--text]">
            2
          </div>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[--text]">Register and start</h2>
            <div className="space-y-2">
              <CodeBlock
                command="agentic-dashboard register ~/Sourcecode/your-project"
                copyLabel="Copy register command"
              />
              <CodeBlock command="agentic-dashboard start" copyLabel="Copy start command" />
            </div>
          </div>
        </li>

        <li className="grid grid-cols-[40px_1fr] gap-4">
          <div className="flex aspect-square w-8 items-center justify-center rounded-full bg-[--surface-elevated] text-sm font-semibold text-[--text]">
            3
          </div>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[--text]">Click the pair URL</h2>
            <p className="text-base leading-relaxed text-[--text-muted]">
              When the agent prints a pair URL like{' '}
              <code className="break-all font-mono text-sm">
                https://agenticapps-dashboard.pages.dev/pair?...
              </code>
              , click it. You&apos;ll land back here, paired.
            </p>
          </div>
        </li>
      </ol>

      <details className="mt-12 max-w-prose">
        <summary className="cursor-pointer text-sm text-[--accent] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]">
          Why local-only →
        </summary>
        <p className="mt-3 text-base leading-relaxed text-[--text-muted]">
          Your <code className="font-mono text-sm">.planning/</code>,{' '}
          <code className="font-mono text-sm">.claude/</code>, and git history are sensitive.
          This dashboard never uploads them. The agent runs on your machine, reads project files
          locally, and serves them to a static page in your browser over a
          bearer-token-authenticated loopback (or Tailscale) connection. No third-party service,
          no telemetry, no analytics.
        </p>
      </details>
    </div>
  )
}
