/**
 * Sidebar — 240px left navigation sidebar (Phase 5.1 Wave 1).
 *
 * Sections (top → bottom): WORKSPACE → Observability → ACCOUNT.
 * Projects sub-list sourced from useRegistryList() directly (RESEARCH OQ-4 resolution).
 *
 * Phase 10 D-10-08 (COV-09): OBSERVE section replaced with Observability section containing
 * a single Coverage entry linking to /coverage. Section architecture allows growth.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'
import { Link } from '@tanstack/react-router'
import { Activity, Cog, HelpCircle, FolderKanban } from 'lucide-react'

import { useRegistryList } from '../../lib/registry.js'

import { SidebarSection } from './SidebarSection.js'
import { SidebarItem } from './SidebarItem.js'
import { SidebarSubItem } from './SidebarSubItem.js'

export function Sidebar(): React.JSX.Element {
  const list = useRegistryList()
  const projects = list.data ?? []
  const projectCount = projects.length

  return (
    <aside
      aria-label="Primary navigation"
      className="w-60 h-screen bg-sidebar-bg border-r border-border-subtle flex flex-col"
    >
      {/* Logo */}
      <Link
        to="/"
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
            to="/"
            icon={<FolderKanban size={16} aria-hidden="true" />}
            label={`Projects (${projectCount})`}
          />
          {projects.map((p) => (
            <SidebarSubItem
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              label={p.name}
              statusDot={p.status.reachable ? 'green' : 'gray'}
            />
          ))}
        </SidebarSection>

        {/* Observability section — Phase 10 D-10-08.
            v1.0 contains a single 'Coverage' entry. Single-item sections are acceptable
            per CONTEXT.md ("section architecture that can grow"). COV-09. */}
        <SidebarSection label="Observability">
          <SidebarItem
            to="/coverage"
            icon={<Activity size={16} aria-hidden="true" />}
            label="Coverage"
          />
        </SidebarSection>

        <SidebarSection label="ACCOUNT">
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
