/**
 * MigrationNotice — project-dashboard › Single-Project Header Context,
 * scenario "Opening a GSD-only project explains the migration".
 *
 * A project reporting `needs-migration` has the workflow skill installed but
 * still uses the pre-OpenSpec planning layout. The daemon reads no change data
 * for it, so the centre column has nothing to render — but "nothing" must read
 * as a known, explained state rather than as a blank page or a failure.
 *
 * Deliberately not `role="alert"`: this is informational. The project is not
 * broken and nothing here needs urgent attention. It is also why the copy names
 * migration rather than installation — the workflow is already present, and
 * telling this user to install it is the contradiction the change review caught
 * on the home card.
 */
import { GitBranchPlus } from 'lucide-react'
import React from 'react'

import { PanelContainer } from './PanelContainer.js'

export function MigrationNotice(): React.JSX.Element {
  return (
    <PanelContainer panelId="migration-notice" title="Change Progress">
      <div data-testid="migration-notice" className="flex flex-col items-center gap-2 py-6 text-center">
        <span aria-hidden="true">
          <GitBranchPlus size={20} className="text-text-tertiary" />
        </span>
        <h3 className="text-base font-semibold text-text-primary">Not yet migrated to OpenSpec</h3>
        <p className="max-w-[52ch] text-sm text-text-secondary">
          This project&rsquo;s planning layout predates OpenSpec, so there are no changes or
          capabilities to read. Progress data resumes once it migrates. Its history stays readable
          on disk under <code className="font-mono text-sm">.planning/</code> in the meantime.
        </p>
        {/*
         * The home card offers `migrate →`; without this the detail view — the
         * place the user went for *more* — would offer strictly less than the
         * summary that sent them here.
         */}
        <a
          href="https://github.com/agenticapps-eu/claude-workflow"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md py-1.5 text-sm text-accent underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          How to migrate &rarr;
        </a>
      </div>
    </PanelContainer>
  )
}
