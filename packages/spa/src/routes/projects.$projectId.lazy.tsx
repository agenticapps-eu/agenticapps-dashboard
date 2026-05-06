import { createLazyRoute, useParams } from '@tanstack/react-router'

import { ProjectLayout } from '../components/ProjectLayout.js'
import { SingleProjectView } from '../components/SingleProjectView.js'

export const Route = createLazyRoute('/projects/$projectId')({
  component: ProjectIdPage,
})

function ProjectIdPage(): React.JSX.Element {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  return (
    <ProjectLayout>
      <SingleProjectView projectId={projectId} />
    </ProjectLayout>
  )
}
