import { useEffect } from 'react'
import { Link, createLazyRoute, useParams } from '@tanstack/react-router'

export const Route = createLazyRoute('/projects/$projectId')({
  component: ProjectIdPlaceholder,
})

function ProjectIdPlaceholder(): React.JSX.Element {
  const { projectId } = useParams({ from: '/projects/$projectId' })

  useEffect(() => {
    document.title = `${projectId} — AgenticApps Dashboard`
  }, [projectId])

  return (
    <section className="rounded-md border border-[--border] bg-[--surface] p-6">
      <Link
        to="/"
        className="text-sm text-[--accent] underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
      >
        ← Back to all projects
      </Link>
      <h2 className="mt-4 text-xl font-semibold leading-snug text-[--text]">Three-column view</h2>
      <p className="mt-3 text-base leading-relaxed text-[--text-muted]">
        Phase 4 work — this view lands in the next phase with Discipline and Phase columns.
      </p>
    </section>
  )
}
