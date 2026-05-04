/**
 * appShellWidth stub — plan 03-08 wave 3.
 * The canonical implementation lives in plan 03-01's worktree.
 */
let current = 'max-w-3xl'
const listeners: Array<() => void> = []

export function setAppShellWidth(width: string): void {
  current = width
  for (const l of listeners) l()
}

export function getAppShellWidth(): string {
  return current
}

export function subscribeAppShellWidth(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    const idx = listeners.indexOf(listener)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}
