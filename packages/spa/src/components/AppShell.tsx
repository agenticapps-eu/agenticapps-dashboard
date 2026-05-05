import { Outlet } from '@tanstack/react-router'

import { useAppShellWidth } from '../lib/appShellWidth.js'

import { CommandPalette } from './CommandPalette.js'
import { Header } from './Header.js'
import { RepairBanner } from './RepairBanner.js'

export function AppShell(): React.JSX.Element {
  const mainWidth = useAppShellWidth()
  return (
    <div className="flex min-h-screen flex-col bg-[--bg] text-[--text]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[--accent] focus:px-3 focus:py-2 focus:text-[--accent-fg]"
      >
        Skip to main content
      </a>
      <Header />
      <div data-slot="banner-mount">
        <RepairBanner />
      </div>
      <main id="main" className={`mx-auto w-full ${mainWidth} flex-1 px-6 py-8 md:px-8`}>
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  )
}
