import { describe, it, expect } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

import { HookFiringSchema } from '@agenticapps/dashboard-shared'
import { extractFirings } from '../lib/extractFirings.js'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `extract-firings-test-${randomBytes(4).toString('hex')}`)
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

function makeToolUseLine(toolName: string, timestamp = '2026-05-07T10:00:00Z'): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: 'uuid-' + toolName,
    timestamp,
    sessionId: 'test-session',
    cwd: '/tmp/test',
    version: '2.1.0',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-' + toolName,
          name: toolName,
          input: { command: 'echo hello' },
        },
      ],
    },
  })
}

function makeTextLine(text: string, timestamp = '2026-05-07T10:00:00Z'): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: 'uuid-text',
    timestamp,
    sessionId: 'test-session',
    cwd: '/tmp/test',
    version: '2.1.0',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
    },
  })
}

describe('extractFirings', () => {
  it('returns an empty array for an empty transcript', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      writeFileSync(path, '')
      const result = await extractFirings(path)
      expect(result).toEqual([])
    } finally {
      cleanup(dir)
    }
  })

  it('extracts a tool_use firing as a HookFiring with hook: PostToolUse', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      writeFileSync(path, makeToolUseLine('Bash') + '\n')
      const result = await extractFirings(path)
      expect(result.length).toBeGreaterThanOrEqual(1)
      const firing = result[0]!
      expect(firing.skill).toBe('Bash')
      expect(firing.hook).toBe('PostToolUse')
      expect(typeof firing.ts).toBe('string')
    } finally {
      cleanup(dir)
    }
  })

  it('every emitted firing validates against HookFiringSchema', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      const lines = [
        makeToolUseLine('Bash', '2026-05-07T10:00:00Z'),
        makeToolUseLine('Read', '2026-05-07T10:01:00Z'),
        makeToolUseLine('Write', '2026-05-07T10:02:00Z'),
      ]
      writeFileSync(path, lines.join('\n') + '\n')
      const result = await extractFirings(path)
      expect(result.length).toBeGreaterThanOrEqual(3)
      for (const firing of result) {
        expect(() => HookFiringSchema.parse(firing)).not.toThrow()
      }
    } finally {
      cleanup(dir)
    }
  })

  it('skips lines that do not parse as JSON (no throw)', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      const lines = ['not valid json', '{"incomplete":', makeToolUseLine('Bash')]
      writeFileSync(path, lines.join('\n') + '\n')
      // Should not throw; should still extract the valid Bash tool use
      const result = await extractFirings(path)
      const bashFiring = result.find((f) => f.skill === 'Bash')
      expect(bashFiring).toBeDefined()
    } finally {
      cleanup(dir)
    }
  })

  it('text-only messages produce no firings', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      const lines = [
        makeTextLine('Some assistant text'),
        makeTextLine('## Workflow commitment\n\nSome commitment'),
      ]
      writeFileSync(path, lines.join('\n') + '\n')
      const result = await extractFirings(path)
      expect(result).toEqual([])
    } finally {
      cleanup(dir)
    }
  })

  it('extracts multiple tool firings from a single assistant message with multiple tool_use blocks', async () => {
    const dir = makeTmpDir()
    try {
      const path = join(dir, 'transcript.jsonl')
      const multiToolLine = JSON.stringify({
        type: 'assistant',
        uuid: 'uuid-multi',
        timestamp: '2026-05-07T10:00:00Z',
        sessionId: 'test-session',
        cwd: '/tmp/test',
        version: '2.1.0',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'id-1', name: 'Read', input: {} },
            { type: 'tool_use', id: 'id-2', name: 'Bash', input: {} },
          ],
        },
      })
      writeFileSync(path, multiToolLine + '\n')
      const result = await extractFirings(path)
      const names = result.map((f) => f.skill)
      expect(names).toContain('Read')
      expect(names).toContain('Bash')
    } finally {
      cleanup(dir)
    }
  })

  it('reads the real fixture file (sample-transcript.jsonl) without throwing', async () => {
    const fixturePath = new URL('../test/__fixtures__/sample-transcript.jsonl', import.meta.url).pathname
    const result = await extractFirings(fixturePath)
    // All returned firings must validate against HookFiringSchema
    for (const firing of result) {
      expect(() => HookFiringSchema.parse(firing)).not.toThrow()
    }
  })
})
