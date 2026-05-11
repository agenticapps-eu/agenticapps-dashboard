/**
 * HelpPage — shared shell for every help anchor MDX page.
 *
 * Renders the MDX content + sets document.title from frontmatter.
 * Used by the 6 lazy wrappers in packages/spa/src/help/pages/*.lazy.tsx.
 *
 * Document title format (OQ-7-C): "{title} · AgenticApps Dashboard Help"
 * (interpunct separator).
 *
 * Plan 07-05 Task 2.
 */
import { useEffect } from 'react'

export interface HelpPageFrontmatter {
  slug: string
  title: string
  order: number
  section: string
}

export interface HelpPageProps {
  FmComponent: React.ComponentType
  frontmatter: HelpPageFrontmatter
}

export function HelpPage({ FmComponent, frontmatter }: HelpPageProps): React.JSX.Element {
  useEffect(() => {
    document.title = `${frontmatter.title} · AgenticApps Dashboard Help`
  }, [frontmatter.title])

  return <FmComponent />
}
