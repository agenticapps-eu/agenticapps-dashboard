/**
 * UnreachableNotice — the centre column for a project whose root the daemon
 * cannot see.
 *
 * `filesystem-access-policy` makes reachability win over the marker matrix
 * precisely because an unreadable root reads as "both markers absent". Without
 * that precedence an unmounted volume renders as `no-workflow` and tells the
 * user to install a workflow into a path the daemon cannot reach.
 *
 * The same trap exists one layer down. Change Progress would receive
 * `present: false` for an unreachable root — the openspec/ stat simply fails —
 * and state "This project has no openspec/ directory", which is a positive claim
 * about a filesystem nobody can currently read. The honest answer is that the
 * daemon cannot see it, and that says nothing about what is on it.
 */
import { PlugZap } from 'lucide-react'
import React from 'react'

import { PanelContainer } from './PanelContainer.js'

export interface UnreachableNoticeProps {
  /** The registered root, shown so the user can tell which mount is missing. */
  root: string | null
}

export function UnreachableNotice({ root }: UnreachableNoticeProps): React.JSX.Element {
  return (
    <PanelContainer panelId="unreachable-notice" title="Change Progress">
      <div
        data-testid="unreachable-notice"
        className="flex flex-col items-center gap-2 py-6 text-center"
      >
        <span aria-hidden="true">
          <PlugZap size={20} className="text-text-tertiary" />
        </span>
        <h3 className="text-base font-semibold text-text-primary">Project root unreachable</h3>
        <p className="max-w-[52ch] text-sm text-text-secondary">
          The daemon cannot read this project&rsquo;s root, so there is nothing to report about
          its changes or capabilities. This says nothing about what the project contains — only
          that the path is not currently readable.
        </p>
        {root ? <p className="font-mono text-xs text-text-tertiary">{root}</p> : null}
      </div>
    </PanelContainer>
  )
}
