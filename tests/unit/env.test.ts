import { describe, expect, test } from 'bun:test'
import { ConfigError, getConfig, parseRetentionPolicy, type EdgeGistBindings } from '../../src/env'
import { createMigratedTestD1 } from '../../src/testing/mock-d1'

describe('history retention config', () => {
  test('uses latest-N retention from max versions', () => {
    expect(parseRetentionPolicy(env({ EDGEGIST_HISTORY_MAX_VERSIONS: '7' }))).toEqual({
      count: 7,
    })
  })

  test('defaults to 100 retained versions', () => {
    expect(parseRetentionPolicy(env({}))).toEqual({
      count: 100,
    })
  })

  test('supports zero retained versions', () => {
    expect(parseRetentionPolicy(env({ EDGEGIST_HISTORY_MAX_VERSIONS: '0' }))).toEqual({
      count: 0,
    })
  })

  test('rejects invalid max versions', () => {
    expect(() => parseRetentionPolicy(env({ EDGEGIST_HISTORY_MAX_VERSIONS: '-1' }))).toThrow(ConfigError)
  })
})

describe('Turnstile config', () => {
  test('enables Turnstile only when site and secret keys are both configured', () => {
    expect(getConfig(ownerEnv({})).turnstile).toBeNull()
    expect(getConfig(ownerEnv({
      EDGEGIST_TURNSTILE_SITE_KEY: 'site-key',
      EDGEGIST_TURNSTILE_SECRET_KEY: 'secret-key',
    })).turnstile).toEqual({
      siteKey: 'site-key',
      secretKey: 'secret-key',
    })
  })

  test('disables Turnstile for local development requests even when keys are configured', () => {
    const env = ownerEnv({
      EDGEGIST_TURNSTILE_SITE_KEY: 'site-key',
      EDGEGIST_TURNSTILE_SECRET_KEY: 'secret-key',
    })

    expect(getConfig(env, 'http://127.0.0.1:8787/owner').turnstile).toBeNull()
    expect(getConfig(env, 'http://localhost:8787/owner').turnstile).toBeNull()
    expect(getConfig(env, 'http://0.0.0.0:8787/owner').turnstile).toBeNull()
    expect(getConfig(env, 'https://edgegist.test/owner').turnstile).toEqual({
      siteKey: 'site-key',
      secretKey: 'secret-key',
    })
  })

  test('rejects partial Turnstile config', () => {
    expect(() => getConfig(ownerEnv({ EDGEGIST_TURNSTILE_SITE_KEY: 'site-key' }))).toThrow(ConfigError)
    expect(() => getConfig(ownerEnv({ EDGEGIST_TURNSTILE_SECRET_KEY: 'secret-key' }))).toThrow(ConfigError)
    expect(
      getConfig(ownerEnv({ EDGEGIST_TURNSTILE_SITE_KEY: 'site-key' }), 'http://127.0.0.1:8787/owner').turnstile,
    ).toBeNull()
  })
})

function env(overrides: Partial<EdgeGistBindings>): EdgeGistBindings {
  return {
    DB: createMigratedTestD1(),
    ...overrides,
  }
}

function ownerEnv(overrides: Partial<EdgeGistBindings>): EdgeGistBindings {
  return env({
    EDGEGIST_OWNER_USERNAME: 'owner',
    EDGEGIST_OWNER_PASSWORD: 'password',
    EDGEGIST_OWNER_TOKEN: 'token',
    ...overrides,
  })
}
