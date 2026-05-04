import { useEffect } from 'react'
import { createLazyRoute } from '@tanstack/react-router'
import { getPairing } from '../lib/pairing.js'

export const Route = createLazyRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  useEffect(() => {
    document.title = 'AgenticApps Dashboard'
  }, [])
  // The router's beforeLoad guard guarantees getPairing() is non-null here.
  // Cover the impossible-but-defensive case anyway.
  const pairing = getPairing()
  return (
    <section className="rounded-md border border-[--border] bg-[--surface] p-6">
      <h2 className="text-xl font-semibold leading-snug text-[--text]">Home</h2>
      <p className="mt-3 text-base leading-relaxed text-[--text-muted]">
        Multi-project home arrives in Phase 3. Until then, this confirms you&apos;re paired with{' '}
        <code className="font-mono text-sm">{pairing?.agentUrl ?? '(unpaired)'}</code>.
      </p>
    </section>
  )
}
