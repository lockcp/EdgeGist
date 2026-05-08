import { createApp } from '../src/index'
import type { EdgeGistBindings } from '../src/env'
import { createMigratedTestD1 } from '../src/testing/mock-d1'

export function createTestEnv(overrides: Partial<EdgeGistBindings> = {}): EdgeGistBindings {
  return {
    DB: createMigratedTestD1(),
    EDGEGIST_OWNER_USERNAME: 'owner',
    EDGEGIST_OWNER_PASSWORD: 'password',
    EDGEGIST_OWNER_TOKEN: 'test-token',
    EDGEGIST_BASE_URL: 'https://edgegist.test',
    EDGEGIST_HISTORY_MAX_VERSIONS: '100',
    ...overrides,
  }
}

export function ownerHeaders(init: HeadersInit = {}): HeadersInit {
  return {
    authorization: 'Bearer test-token',
    'content-type': 'application/json',
    ...init,
  }
}

export async function createTestGist(
  env: EdgeGistBindings,
  payload: Record<string, unknown> = {},
) {
  const app = createApp()
  const response = await app.request(
    '/gists',
    {
      method: 'POST',
      headers: ownerHeaders(),
      body: JSON.stringify({
        description: 'test gist',
        public: false,
        files: {
          'config.json': {
            content: '{"enabled":true}',
          },
        },
        ...payload,
      }),
    },
    env,
  )
  if (!response.ok) {
    throw new Error(`Failed to create test gist: ${response.status} ${await response.text()}`)
  }
  return response.json() as Promise<Record<string, unknown>>
}
