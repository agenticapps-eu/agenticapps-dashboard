import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

import '@testing-library/jest-dom/vitest'

// Vitest does not auto-cleanup between tests when `globals: false`. Without
// this, multiple `render(<App />)` calls in the same suite leave stacked DOM
// trees and `getByTestId` throws "Found multiple elements".
afterEach(() => {
  cleanup()
})
