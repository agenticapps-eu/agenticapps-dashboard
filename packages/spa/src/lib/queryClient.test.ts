import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { createQueryClient } from './queryClient.js'
import { ApiError } from './api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('createQueryClient', () => {
  it('QueryCache onError flips needsRepair on ApiError(401)', () => {
    const repair = { setNeedsRepair: vi.fn() }
    const qc = createQueryClient(repair)
    const onError = qc.getQueryCache().config.onError
    expect(onError).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(onError as any)(new ApiError(401, undefined, 'unauthorized'), {} as any)
    expect(repair.setNeedsRepair).toHaveBeenCalledOnce()
    expect(repair.setNeedsRepair).toHaveBeenCalledWith(true)
  })

  it('QueryCache onError ignores TypeError (Pitfall 4)', () => {
    const repair = { setNeedsRepair: vi.fn() }
    const qc = createQueryClient(repair)
    const onError = qc.getQueryCache().config.onError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(onError as any)(new TypeError('Failed to fetch'), {} as any)
    expect(repair.setNeedsRepair).not.toHaveBeenCalled()
  })

  it('QueryCache onError ignores non-401 ApiError', () => {
    const repair = { setNeedsRepair: vi.fn() }
    const qc = createQueryClient(repair)
    const onError = qc.getQueryCache().config.onError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(onError as any)(new ApiError(500, undefined, 'server error'), {} as any)
    expect(repair.setNeedsRepair).not.toHaveBeenCalled()
  })

  it('defaultOptions.queries.retry is false (D-07)', () => {
    const repair = { setNeedsRepair: vi.fn() }
    const qc = createQueryClient(repair)
    expect(qc.getDefaultOptions().queries?.retry).toBe(false)
  })

  it('no query.state.data guard in queryClient.ts source (Pitfall 5 source-level guard)', () => {
    const source = readFileSync(join(__dirname, 'queryClient.ts'), 'utf-8')
    expect(source).not.toMatch(/query\.state\.data\s*!==/)
  })
})
