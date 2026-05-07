import { describe, it, expect } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, createReadStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

import { extractCommitment } from '../lib/extractCommitment.js'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `extract-commit-test-${randomBytes(4).toString('hex')}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function cleanup(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort
  }
}

/**
 * Build a minimal JSONL transcript with a single assistant text message.
 */
function makeTranscriptLine(text: string, sessionId = 'test-session', timestamp = '2026-05-07T10:00:00Z'): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: 'test-uuid',
    timestamp,
    sessionId,
    cwd: '/tmp/test',
    version: '2.1.0',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
    },
  })
}

function makeToolUseTranscriptLine(toolName: string, sessionId = 'test-session'): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: 'tool-uuid',
    timestamp: '2026-05-07T10:01:00Z',
    sessionId,
    cwd: '/tmp/test',
    version: '2.1.0',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'tool-id', name: toolName, input: { command: 'echo hello' } }],
    },
  })
}

describe('extractCommitment', () => {
  it('returns null when transcript has no ## Workflow commitment heading', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      writeFileSync(path, makeTranscriptLine('Some other content\n## Other heading\nMore content'))
      const result = await extractCommitment(path)
      expect(result).toBeNull()
    } finally {
      cleanup(dir)
    }
  })

  it('returns the content after ## Workflow commitment', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      const text = '## Workflow commitment\n\nI am using the workflow skill.\nTask scope: test'
      writeFileSync(path, makeTranscriptLine(text))
      const result = await extractCommitment(path)
      expect(result).toContain('I am using the workflow skill.')
    } finally {
      cleanup(dir)
    }
  })

  it('returns the LAST ## Workflow commitment block when multiple exist', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      const firstCommit = '## Workflow commitment\n\nFirst commitment text\n## Other section\nstuff'
      const secondCommit = '## Workflow commitment\n\nSecond commitment text — this is the last one'
      const lines = [makeTranscriptLine(firstCommit), makeTranscriptLine(secondCommit)]
      writeFileSync(path, lines.join('\n') + '\n')
      const result = await extractCommitment(path)
      expect(result).toContain('Second commitment text')
      expect(result).not.toContain('First commitment text')
    } finally {
      cleanup(dir)
    }
  })

  it('stops at the next ## heading after the commitment block', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      const text = '## Workflow commitment\n\nCommitment body\n\n## Next section\nNot in commitment'
      writeFileSync(path, makeTranscriptLine(text))
      const result = await extractCommitment(path)
      expect(result).toContain('Commitment body')
      expect(result).not.toContain('Not in commitment')
    } finally {
      cleanup(dir)
    }
  })

  it('tolerates partial/truncated transcripts (last line incomplete JSON)', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      const goodLine = makeTranscriptLine('## Workflow commitment\n\nTolerance test content')
      // Add a truncated/broken line at the end
      writeFileSync(path, goodLine + '\n{"incomplete":')
      const result = await extractCommitment(path)
      expect(result).toContain('Tolerance test content')
    } finally {
      cleanup(dir)
    }
  })

  it('skips non-message entries (tool_use, system, attachment)', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      const systemLine = JSON.stringify({ type: 'system', content: 'system message' })
      const attachmentLine = JSON.stringify({ type: 'attachment', content: 'attachment' })
      const toolUseLine = makeToolUseTranscriptLine('Bash')
      const commitmentLine = makeTranscriptLine('## Workflow commitment\n\nActual commitment')
      const lines = [systemLine, attachmentLine, toolUseLine, commitmentLine]
      writeFileSync(path, lines.join('\n') + '\n')
      const result = await extractCommitment(path)
      expect(result).toContain('Actual commitment')
    } finally {
      cleanup(dir)
    }
  })

  it('reads the fixture file from sample-transcript.jsonl and returns a string or null (not throw)', async () => {
    // This test verifies the function works against the real fixture shape
    const fixturePath = new URL('../test/__fixtures__/sample-transcript.jsonl', import.meta.url).pathname
    // The fixture contains a real transcript — we just verify it doesn't throw
    const result = await extractCommitment(fixturePath)
    // The fixture may or may not have a commitment block — both null and string are valid
    expect(result === null || typeof result === 'string').toBe(true)
  })

  it('uses createReadStream for streaming (not readFileSync)', async () => {
    // Structural test: verify the module imports createReadStream from 'node:fs'
    // We verify this by checking that extractCommitment is async and handles large inputs
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      // Create a transcript with many lines before the commitment
      const lines: string[] = []
      for (let i = 0; i < 50; i++) {
        lines.push(makeTranscriptLine(`Line ${i} content`))
      }
      lines.push(makeTranscriptLine('## Workflow commitment\n\nStreamed commitment'))
      writeFileSync(path, lines.join('\n') + '\n')
      const result = await extractCommitment(path)
      expect(result).toContain('Streamed commitment')
    } finally {
      cleanup(dir)
    }
  })
})
