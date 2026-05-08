import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { HookFiringSchema, type HookFiring } from '@agenticapps/dashboard-shared'

/**
 * Extract hook firings from a Claude Code transcript JSONL file.
 *
 * Line shapes handled (per Wave-0 probe / sample-transcript.jsonl):
 *
 * Shape A — explicit hook firing record (future extension):
 *   { hook_event_name: string, timestamp: string, skill?: string, ... }
 *   → { ts: timestamp, skill: skill ?? 'session', hook: hook_event_name }
 *
 * Shape B — assistant message with tool_use content blocks:
 *   { type: 'assistant', message: { content: [{ type: 'tool_use', name: string }, ...] }, timestamp }
 *   → { ts: entry.timestamp, skill: name, hook: 'PostToolUse' } for each tool_use block
 *
 * Lines that do not parse as JSON are skipped silently.
 * Only firings that validate against HookFiringSchema are emitted.
 *
 * @param transcriptPath - Absolute path to the transcript JSONL file.
 * @returns Array of HookFiring objects validated by HookFiringSchema.
 */
export async function extractFirings(transcriptPath: string): Promise<HookFiring[]> {
  const stream = createReadStream(transcriptPath, { encoding: 'utf8' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  const firings: HookFiring[] = []

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Skip comment lines (fixture files start with //)
    if (trimmed.startsWith('//')) continue

    let entry: unknown
    try {
      entry = JSON.parse(trimmed)
    } catch {
      // Partial or non-JSON line — skip silently
      continue
    }

    const candidates = entryToFirings(entry)
    for (const candidate of candidates) {
      const parsed = HookFiringSchema.safeParse(candidate)
      if (parsed.success) {
        firings.push(parsed.data)
      }
    }
  }

  return firings
}

/**
 * Convert a single transcript entry to zero or more hook firing candidates.
 *
 * Shape A: explicit hook firing record (hook_event_name present)
 * Shape B: assistant message with tool_use blocks → one firing per tool_use
 */
function entryToFirings(entry: unknown): Array<{ ts: string; skill: string; hook: string }> {
  if (typeof entry !== 'object' || entry === null) return []
  const e = entry as Record<string, unknown>

  // Shape A: explicit hook firing (hook_event_name + timestamp at top level)
  if (typeof e['hook_event_name'] === 'string' && typeof e['timestamp'] === 'string') {
    return [
      {
        ts: e['timestamp'],
        skill: typeof e['skill'] === 'string' ? e['skill'] : 'session',
        hook: e['hook_event_name'],
      },
    ]
  }

  // Shape B: assistant message with tool_use content blocks
  if (e['type'] !== 'assistant') return []

  const timestamp = typeof e['timestamp'] === 'string' ? e['timestamp'] : ''
  if (!timestamp) return []

  const msg = e['message']
  if (typeof msg !== 'object' || msg === null) return []
  const m = msg as Record<string, unknown>

  const content = m['content']
  if (!Array.isArray(content)) return []

  const results: Array<{ ts: string; skill: string; hook: string }> = []
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    const b = block as Record<string, unknown>
    if (b['type'] === 'tool_use' && typeof b['name'] === 'string') {
      results.push({
        ts: timestamp,
        skill: b['name'],
        hook: 'PostToolUse',
      })
    }
  }

  return results
}
