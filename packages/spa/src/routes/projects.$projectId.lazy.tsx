import { createLazyRoute, useParams } from '@tanstack/react-router'

import { SingleProjectView } from '../components/SingleProjectView.js'

export const Route = createLazyRoute('/projects/$projectId')({
  component: ProjectIdPage,
})

function ProjectIdPage(): React.JSX.Element {
  const { projectId } = useParams({ strict: false })
  return <SingleProjectView projectId={projectId ?? ''} />
}
