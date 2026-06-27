/**
 * Sidebar — 240px left navigation sidebar (Phase 5.1 Wave 1).
 *
 * Sections (top → bottom): WORKSPACE → Observability → Code Intelligence → ACCOUNT.
 * Projects sub-list sourced from useRegistryList() directly (RESEARCH OQ-4 resolution).
 *
 * Phase 10 D-10-08 (COV-09): OBSERVE section replaced with Observability section containing
 * a single Coverage entry linking to /coverage. Section architecture allows growth.
 *
 * Phase 14 D-14-06: Code Intelligence section inserted between Observability and ACCOUNT.
 * Contains Knowledge graphs entry linking to /code-intelligence. Section as new peer
 * (not sub-item) per user sidebar-architecture preference: new section with growth room
 * for future GitNexus explorer entries.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'
import { Link } from '@tanstack/react-router'
import { Activity, Cog, HelpCircle, FolderKanban, Layers, TrendingUp, Network } from 'lucide-react'

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

        {/* Observability section — Phase 10 D-10-08 introduced Coverage; Phase 11 D-11-08
            added Skill drift as a peer; Phase 12 D-12-01 graduates the section to 3 peer
            entries: Coverage / Skill drift / Conformance. Order preserves existing IA
            (user-memory feedback_sidebar_section_architecture: additive growth over
            reorder — documented deviation from RESEARCH OQ3 which suggested
            Coverage → Conformance → Skill drift; we keep Phase 11's anchor in place to
            avoid retraining users already familiar with the existing pattern).
            All three use the SidebarItem peer primitive (NOT SidebarSubItem).
            Icons: Activity (Coverage), Layers (Skill drift), TrendingUp (Conformance) —
            visually distinct lucide-react glyphs. */}
        <SidebarSection label="Observability">
          <SidebarItem
            to="/coverage"
            icon={<Activity size={16} aria-hidden="true" />}
            label="Coverage"
          />
          <SidebarItem
            to="/observability/skill-drift"
            icon={<Layers size={16} aria-hidden="true" />}
            label="Skill drift"
          />
          <SidebarItem
            to="/observability/conformance"
            icon={<TrendingUp size={16} aria-hidden="true" />}
            label="Conformance"
          />
        </SidebarSection>

        {/* Code Intelligence section — Phase 14 D-14-06. Inserted between Observability
            and ACCOUNT as a NEW section (not sub-item) per user sidebar-architecture
            preference: section with growth room for future GitNexus explorer entries. */}
        <SidebarSection label="Code Intelligence">
          <SidebarItem
            to="/code-intelligence"
            icon={<Network size={16} aria-hidden="true" />}
            label="Knowledge graphs"
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
