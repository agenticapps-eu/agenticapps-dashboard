/**
 * Sidebar — 240px left navigation sidebar (Phase 5.1 Wave 1).
 *
 * Two sections, top → bottom: WORKSPACE (product content) → UTILITIES.
 *
 * `App Shell And Sidebar Information Architecture` (design-system, MODIFIED by
 * retire-v1-surfaces) reduced this from four sections. Observability and Code
 * Intelligence are gone with the surfaces they led to, and WORKSPACE no longer
 * enumerates registered projects: the fleet surface is that list, and a sidebar
 * that grows with the registry is the thing the requirement forbids by name.
 *
 * **UTILITIES, not ACCOUNT.** The group holds settings *and* help, and help is
 * not account-level content — naming the group for the account would misfile
 * it, which design §5 calls out in as many words.
 *
 * **Peer order is inherited, not re-chosen.** Workflow → Fleet readiness →
 * Changes is the order these three already had. Withdrawing the Projects entry
 * that sat above them is a removal, and a removal does not license a reorder.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'
import { Link } from '@tanstack/react-router'
import { Cog, HelpCircle, KanbanSquare, ShieldCheck, Workflow } from 'lucide-react'

import { SidebarSection } from './SidebarSection.js'
import { SidebarItem } from './SidebarItem.js'

export function Sidebar(): React.JSX.Element {
  return (
    <aside
      aria-label="Primary navigation"
      className="w-60 h-screen bg-sidebar-bg border-r border-border-subtle flex flex-col"
    >
      {/* Logo. Points at the fleet rather than `/`: the origin still answers,
          by redirecting, but the product should not route its own chrome
          through a location it withdrew. */}
      <Link
        to="/fleet"
        className="flex items-center gap-2 px-4 py-4 h-16 text-base font-semibold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          aria-hidden="true"
          className="inline-block w-6 h-6 rounded-md bg-accent shrink-0"
        />
        <span>AgenticApps</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col gap-2">
        <SidebarSection label="WORKSPACE">
          <SidebarItem
            to="/workflow"
            icon={<Workflow size={16} aria-hidden="true" />}
            label="Workflow"
          />
          {/* Fleet readiness — add-repo-readiness §9. Also owns /repos, which
              is where a repo detail lives and is reachable only from here. */}
          <SidebarItem
            to="/fleet"
            alsoActiveFor="/repos"
            icon={<ShieldCheck size={16} aria-hidden="true" />}
            label="Fleet readiness"
          />
          {/* Changes — add-agent-change-board §5.8. Product content, not
              instrumentation: the board reports work, not measurement. */}
          <SidebarItem
            to="/changes"
            icon={<KanbanSquare size={16} aria-hidden="true" />}
            label="Changes"
          />
        </SidebarSection>

        <SidebarSection label="UTILITIES">
          <SidebarItem
            to="/settings"
            icon={<Cog size={16} aria-hidden="true" />}
            label="Settings"
          />
          <SidebarItem
            to="/help"
            icon={<HelpCircle size={16} aria-hidden="true" />}
            label="Help"
          />
        </SidebarSection>
      </nav>
    </aside>
  )
}
