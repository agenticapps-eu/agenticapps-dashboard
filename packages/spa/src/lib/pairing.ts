import { PairingSchema, type Pairing } from '@agenticapps/dashboard-shared'

const KEY = 'agentic-dashboard:pairing'

export function getPairing(): Pairing | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    localStorage.removeItem(KEY)
    return null
  }
  const parsed = PairingSchema.safeParse(json)
  if (!parsed.success) {
    console.warn('[pairing] corrupt; clearing')
    localStorage.removeItem(KEY)
    return null
  }
  return parsed.data
}

export function setPairing(p: Pairing): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function clearPairing(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(KEY)
}
