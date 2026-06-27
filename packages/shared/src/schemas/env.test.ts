import { describe, it, expect } from 'vitest'
import {
  ALLOWED_ENV_KEYS,
  AllowedEnvKeySchema,
  EnvFileSchema,
} from './env.js'

describe('ALLOWED_ENV_KEYS', () => {
  it('contains exactly the three allowed keys', () => {
    expect(ALLOWED_ENV_KEYS).toContain('SENTRY_AUTH_TOKEN')
    expect(ALLOWED_ENV_KEYS).toContain('LINEAR_API_KEY')
    expect(ALLOWED_ENV_KEYS).toContain('INFISICAL_TOKEN')
    expect(ALLOWED_ENV_KEYS).toHaveLength(3)
  })
})

describe('AllowedEnvKeySchema', () => {
  it('accepts SENTRY_AUTH_TOKEN', () => {
    expect(AllowedEnvKeySchema.safeParse('SENTRY_AUTH_TOKEN').success).toBe(true)
  })

  it('accepts LINEAR_API_KEY', () => {
    expect(AllowedEnvKeySchema.safeParse('LINEAR_API_KEY').success).toBe(true)
  })

  it('accepts INFISICAL_TOKEN', () => {
    expect(AllowedEnvKeySchema.safeParse('INFISICAL_TOKEN').success).toBe(true)
  })

  it('rejects AWS_SECRET (D-08-13)', () => {
    expect(AllowedEnvKeySchema.safeParse('AWS_SECRET').success).toBe(false)
  })

  it('rejects DATABASE_URL (D-08-13)', () => {
    expect(AllowedEnvKeySchema.safeParse('DATABASE_URL').success).toBe(false)
  })

  it('rejects any unknown key', () => {
    expect(AllowedEnvKeySchema.safeParse('GITHUB_TOKEN').success).toBe(false)
    expect(AllowedEnvKeySchema.safeParse('').success).toBe(false)
    expect(AllowedEnvKeySchema.safeParse('sentry_auth_token').success).toBe(false)
  })
})

describe('EnvFileSchema', () => {
  it('parses a valid env file with one allowed key', () => {
    const result = EnvFileSchema.parse({
      version: 1,
      vars: { SENTRY_AUTH_TOKEN: 'sntrys_xxx' },
    })
    expect(result.version).toBe(1)
    expect(result.vars.SENTRY_AUTH_TOKEN).toBe('sntrys_xxx')
  })

  it('parses a valid env file with multiple allowed keys', () => {
    const result = EnvFileSchema.parse({
      version: 1,
      vars: {
        SENTRY_AUTH_TOKEN: 'sntrys_xxx',
        LINEAR_API_KEY: 'lin_api_yyy',
      },
    })
    expect(result.vars.SENTRY_AUTH_TOKEN).toBe('sntrys_xxx')
    expect(result.vars.LINEAR_API_KEY).toBe('lin_api_yyy')
  })

  it('parses a valid env file with empty vars object', () => {
    const result = EnvFileSchema.parse({ version: 1, vars: {} })
    expect(result.vars).toEqual({})
  })

  it('rejects a vars object containing an unknown key (D-08-13)', () => {
    expect(
      EnvFileSchema.safeParse({
        version: 1,
        vars: { NOPE: 'value' },
      }).success
    ).toBe(false)
  })

  it('rejects a vars object containing AWS_SECRET', () => {
    expect(
      EnvFileSchema.safeParse({
        version: 1,
        vars: { AWS_SECRET: 'secret' },
      }).success
    ).toBe(false)
  })

  it('rejects version !== 1', () => {
    expect(
      EnvFileSchema.safeParse({ version: 2, vars: {} }).success
    ).toBe(false)
  })

  it('rejects version: 0', () => {
    expect(
      EnvFileSchema.safeParse({ version: 0, vars: {} }).success
    ).toBe(false)
  })

  it('rejects missing version field', () => {
    expect(
      EnvFileSchema.safeParse({ vars: {} }).success
    ).toBe(false)
  })

  it('rejects missing vars field', () => {
    expect(
      EnvFileSchema.safeParse({ version: 1 }).success
    ).toBe(false)
  })
})
