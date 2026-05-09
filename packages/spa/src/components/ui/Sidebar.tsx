/**
 * Sidebar — 240px left navigation sidebar (Phase 5.1 Wave 1).
 *
 * UI-SPEC §5: fixed 240px wide (w-60), warm sidebar-bg, 3 sections (WORKSPACE, OBSERVE, ACCOUNT).
 * Projects sub-list sourced from useRegistryList() directly (RESEARCH OQ-4 resolution).
 *
 * OBSERVE section: Skills/Health/Reviews routes are Phase 6+. Rendered as SidebarItemDisabled
 * so the IA shape from UI-SPEC §5 is locked while the actual routes ship in Phase 6.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'
import { Link } from '@tanstack/react-router'
import { Activity, Cog, HelpCircle, FolderKanban, ListChecks, ClipboardList } from 'lucide-react'

import { useRegistryList } from '../../lib/registry.js'

import { SidebarSection } from './SidebarSection.js'
import { SidebarItem, SidebarItemDisabled } from './SidebarItem.js'
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

        <SidebarSection label="OBSERVE">
          {/* Phase 5.1 v1: Skills/Health/Reviews routes are Phase 6+.
              Rendered as disabled to lock the IA shape from UI-SPEC §5
              without linking to non-existent routes. */}
          <SidebarItemDisabled icon={<Activity size={16} aria-hidden="true" />} label="Skills" />
          <SidebarItemDisabled icon={<ListChecks size={16} aria-hidden="true" />} label="Health" />
          <SidebarItemDisabled icon={<ClipboardList size={16} aria-hidden="true" />} label="Reviews" />
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
