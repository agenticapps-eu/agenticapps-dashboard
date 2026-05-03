import { describe, it, expect, vi, afterEach } from 'vitest'
import { agentLog, agentError, generateRequestId } from './logging.js'

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
})
