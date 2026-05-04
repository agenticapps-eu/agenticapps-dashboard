import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './router.js'
import { initTheme } from './lib/theme.js'
import './styles/global.css'

// Apply theme BEFORE first paint to avoid the dark/light flash (D-02).
initTheme()

// Plan 03 will replace this with createQueryClient(repair) once the api wrapper
// + RepairContext exist. For now a default client lets the app boot.
const queryClient = new QueryClient()

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
