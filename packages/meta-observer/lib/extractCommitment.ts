import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

/**
 * Extract the last `## Workflow commitment` block from a Claude Code transcript JSONL file.
 *
 * The transcript is read via streaming (createReadStream + readline) so large files
 * (Pitfall 5 from RESEARCH.md) do not cause OOM.
 *
 * Line shape (per Wave-0 probe / sample-transcript.jsonl):
 *   Each line is a JSON object with top-level `type` field.
 *   For `type: 'assistant'` entries, markdown lives at `message.content[].text`
 *   (where `content[i].type === 'text'`).
 *   Partial/truncated lines (e.g. last line if session crashed) are skipped silently.
 *
 * Mirrors Phase 4 `phaseDetail.ts:101-115` LAST-occurrence semantics.
 *
 * @param transcriptPath - Absolute path to the transcript JSONL file.
 * @returns The last `## Workflow commitment` block body, or null if none found.
 */
export async function extractCommitment(transcriptPath: string): Promise<string | null> {
  const stream = createReadStream(transcriptPath, { encoding: 'utf8' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  const bodies: string[] = []

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Skip comment lines (fixture files start with //)
    if (trimmed.startsWith('//')) continue

    let entry: unknown
    try {
      entry = JSON.parse(trimmed)
    } catch {
      // Partial/truncated line — skip silently (Phase 4 D-22 pattern)
      continue
    }

    const text = extractTextBody(entry)
    if (text !== null) {
      bodies.push(text)
    }
  }

  if (bodies.length === 0) return null

  const joined = bodies.join('\n\n')
  return extractLastCommitmentBlock(joined)
}

/**
 * Extract all concatenated text bodies from a transcript entry.
 * Returns null for non-message entries (attachment, system, etc.).
 *
 * Shape A (user/assistant with content array):
 *   { type: 'user'|'assistant', message: { content: Array<{ type: 'text', text: string }|...> } }
 */
function extractTextBody(entry: unknown): string | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>

  const entryType = e['type']
  if (entryType !== 'user' && entryType !== 'assistant') return null

  const msg = e['message']
  if (typeof msg !== 'object' || msg === null) return null
  const m = msg as Record<string, unknown>

  const content = m['content']
  if (!Array.isArray(content)) return null

  const textParts: string[] = []
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    const b = block as Record<string, unknown>
    if (b['type'] === 'text' && typeof b['text'] === 'string') {
      textParts.push(b['text'])
    }
  }

  if (textParts.length === 0) return null
  return textParts.join('\n')
}

/**
 * Extract the LAST `## Workflow commitment` block from a body string.
 * Mirrors Phase 4 `phaseDetail.ts:101-115` semantics exactly.
 */
function extractLastCommitmentBlock(content: string): string | null {
  const headingRe = /^## Workflow commitment\s*$/gm
  let lastIdx = -1
  let match: RegExpExecArray | null
  while ((match = headingRe.exec(content)) !== null) {
    lastIdx = match.index + match[0].length
  }
  if (lastIdx === -1) return null

  const tail = content.slice(lastIdx)
  const nextH2 = tail.match(/\n## /m)
  const block = nextH2 ? tail.slice(0, nextH2.index) : tail
  const trimmed = block.trim()
  return trimmed.length > 0 ? trimmed : null
}
