import { describe } from 'vitest'

// MISSING — Wave 0 must create apiFetch + parseOrDrift + ApiError in Plan 03
describe.todo('Plan 03: apiFetch — injects Authorization: Bearer header from getPairing()')
describe.todo('Plan 03: apiFetch — 401 throws ApiError(401) (D-06 banner trigger)')
describe.todo('Plan 03: apiFetch — TypeError("Failed to fetch") propagates (NOT ApiError) for ECONNREFUSED (D-07)')
describe.todo('Plan 03: apiFetch — 200 with valid body returns { ok: true, data }')
describe.todo('Plan 03: parseOrDrift — Zod failure returns { ok: false, drift } with first issue path/expected/got (D-09)')
describe.todo('Plan 03: parseOrDrift — console.error logs full issue tree (D-08)')
describe.todo('Plan 03: QueryCache onError flips needsRepair on ApiError(401) only, NOT on TypeError (Pitfall 4)')
