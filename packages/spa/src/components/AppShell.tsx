import { Outlet } from '@tanstack/react-router'
import { Header } from './Header.js'

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-[--bg] text-[--text]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[--accent] focus:px-3 focus:py-2 focus:text-[--accent-fg]"
      >
        Skip to main content
      </a>
      <Header />
      {/* RepairBanner mount slot — Plan 04 wires the banner in. Reserved space is intentional. */}
      <div data-slot="banner-mount" />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 md:px-8">
        <Outlet />
      </main>
    </div>
  )
}
