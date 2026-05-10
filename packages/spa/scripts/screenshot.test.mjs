/**
 * screenshot.test.mjs — Unit tests for screenshot.mjs helper exports.
 *
 * Tests parseViewport() and verifies captureScreenshot is exported.
 * Does NOT call captureScreenshot (requires chromium which CI hasn't installed at this wave).
 *
 * Run: pnpm --filter @agenticapps/dashboard-spa exec vitest run scripts/screenshot.test.mjs
 */
import { describe, it, expect } from 'vitest'
import { parseViewport, captureScreenshot } from './screenshot.mjs'

describe('parseViewport', () => {
  it('parses a valid WxH string', () => {
    expect(parseViewport('1440x900')).toEqual({ width: 1440, height: 900 })
  })

  it('parses a small viewport', () => {
    expect(parseViewport('390x844')).toEqual({ width: 390, height: 844 })
  })

  it('parses a tablet viewport', () => {
    expect(parseViewport('768x1024')).toEqual({ width: 768, height: 1024 })
  })

  it('throws on invalid format (no x)', () => {
    expect(() => parseViewport('bad')).toThrow('Invalid --viewport')
  })

  it('throws on invalid format (letters in dimensions)', () => {
    expect(() => parseViewport('1440xfoo')).toThrow('Invalid --viewport')
  })
})

describe('captureScreenshot export', () => {
  it('is a function (export exists — do not call in unit tests)', () => {
    expect(typeof captureScreenshot).toBe('function')
  })
})
