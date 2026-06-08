import { describe, it, expect, vi, afterEach } from 'vitest'

import { agentLog, agentError, generateRequestId, redactTokens } from './logging.js'

describe('logging utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('agentLog writes to stdout with [agent] prefix', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    agentLog('Hello')
    expect(spy).toHaveBeenCalledWith('[agent] Hello\n')
  })

  it('agentError writes to stderr with [agent] prefix', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    agentError('boom')
    expect(spy).toHaveBeenCalledWith('[agent] boom\n')
  })

  it('generateRequestId returns a string of length 36 matching UUID format', () => {
    const id = generateRequestId()
    expect(id).toHaveLength(36)
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  describe('redactTokens (CSO item 1 — viewer token in logs)', () => {
    it('redacts the value of a ?token= query param', () => {
      expect(
        redactTokens('<-- GET /knowledge-graph.json?token=deadbeefcafe'),
      ).toBe('<-- GET /knowledge-graph.json?token=[REDACTED]')
    })

    it('redacts token when it is not the first query param (&token=)', () => {
      expect(
        redactTokens('--> GET /file-content.json?path=src/a.ts&token=abc123 200 5ms'),
      ).toBe('--> GET /file-content.json?path=src/a.ts&token=[REDACTED] 200 5ms')
    })

    it('stops redacting at the next & so following params survive', () => {
      expect(
        redactTokens('GET /x?token=secret&path=src/b.ts'),
      ).toBe('GET /x?token=[REDACTED]&path=src/b.ts')
    })

    it('leaves strings without a token param untouched', () => {
      expect(redactTokens('<-- GET /api/coverage')).toBe('<-- GET /api/coverage')
    })
  })
})
