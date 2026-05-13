/**
 * clipboardCompat.ts — SPA-side clipboard write with textarea fallback.
 *
 * CODEX LOW-18: navigator.clipboard.writeText (modern HTTPS/localhost) with
 * hidden-textarea + document.execCommand('copy') fallback for older browsers
 * or non-secure contexts.
 *
 * All clipboard writes in the SPA go through this helper — never call
 * navigator.clipboard.writeText directly.
 */

export async function writeToClipboard(text: string): Promise<boolean> {
  // Modern path: navigator.clipboard is available (HTTPS or localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to textarea fallback
    }
  }

  // Fallback for older browsers / non-secure contexts: hidden textarea + execCommand('copy')
  if (typeof document === 'undefined') return false
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.top = '-9999px'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}
