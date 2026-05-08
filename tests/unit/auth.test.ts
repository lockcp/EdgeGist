import { describe, expect, test } from 'bun:test'
import { createApp } from '../../src/index'
import { createTestEnv, ownerHeaders } from '../helpers'

describe('auth and env config', () => {
  test('accepts bearer token for owner operations', async () => {
    const app = createApp()
    const env = createTestEnv()
    const response = await app.request(
      '/gists',
      {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({
          files: {
            'a.txt': { content: 'hello' },
          },
        }),
      },
      env,
    )

    expect(response.status).toBe(201)
  })

  test('rejects a wrong token without leaking configured token', async () => {
    const app = createApp()
    const env = createTestEnv()
    const response = await app.request(
      '/gists',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            'a.txt': { content: 'hello' },
          },
        }),
      },
      env,
    )

    expect(response.status).toBe(401)
    expect(await response.text()).not.toContain('test-token')
  })
})
