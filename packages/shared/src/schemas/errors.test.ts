import { describe, it, expect } from 'vitest'
import { ErrorResponseSchema } from './errors.js'

describe('ErrorResponseSchema', () => {
  it('accepts minimal error', () => {
    expect(() => ErrorResponseSchema.parse({ ok: false, error: 'invalid_request', requestId: 'abc' })).not.toThrow()
  })
  it('accepts error with issues', () => {
    const e = { ok: false, error: 'invalid_request', requestId: 'abc', issues: [{ path: ['body', 'email'], message: 'required' }] }
    expect(() => ErrorResponseSchema.parse(e)).not.toThrow()
  })
  it('rejects ok: true', () => {
    expect(() => ErrorResponseSchema.parse({ ok: true, error: 'x', requestId: 'y' })).toThrow()
  })
})
