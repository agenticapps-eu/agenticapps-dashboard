import { useEffect } from 'react'
import { createLazyRoute } from '@tanstack/react-router'

import { MultiProjectHome } from '../components/MultiProjectHome.js'

export const Route = createLazyRoute('/')({ component: IndexPage })

function IndexPage(): React.JSX.Element {
  useEffect(() => { document.title = 'AgenticApps Dashboard' }, [])
  return <MultiProjectHome />
}
