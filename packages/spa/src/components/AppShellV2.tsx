/**
 * AppShellV2 — New sidebar-driven shell (Phase 5.1 Wave 1).
 *
 * Composition (UI-SPEC §1 global shell grid):
 *   grid-cols: [240px Sidebar] [1fr column: TopBar + RepairBanner + main]
 *
 * Mounted behind VITE_APPSHELL_V2=1 flag via router.tsx pathless layout route.
 * RepairBanner mounts inside AppShellV2, below TopBar — paired-only surfaces only
 * (D-5.1-03: /onboarding and /pair stay at rootRoute, so banner never shows there).
 *
 * OQ-1 resolution: CommandPalette and RepairBanner both mount here (paired-only).
 * OQ-3 resolution: RepairBanner is below TopBar, full-width, above <main>.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities on shell composition
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'
import { Outlet } from '@tanstack/react-router'

import { useGlobalShortcuts } from '../lib/useGlobalShortcuts.js'
import { CommandPalette } from './CommandPalette.js'
import { RepairBanner } from './RepairBanner.js'
import { Sidebar } from './ui/Sidebar.js'
import { TopBar } from './ui/TopBar.js'
import { ToastProvider } from './ui/Toast.js'

export function AppShellV2(): React.JSX.Element {
  // POLISH-01 D-6-01..03 — single keydown listener with focus-guard
  useGlobalShortcuts()
  return (
    <ToastProvider>
    <div
      data-testid="app-shell-v2"
      className="grid h-screen bg-app-bg text-text-primary"
      style={{ gridTemplateColumns: '240px 1fr' }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-white"
        style={{ zIndex: 'var(--z-overlay)' }}
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-h-0 flex-col">
        <TopBar />
        <div data-slot="banner-mount">
          <RepairBanner />
        </div>
        <main id="main" className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
    </ToastProvider>
  )
}
