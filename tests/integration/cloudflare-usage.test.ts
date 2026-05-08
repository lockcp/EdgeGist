import { afterEach, describe, expect, test } from 'bun:test'
import { createApp } from '../../src/index'
import { createTestEnv, ownerHeaders } from '../helpers'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('Cloudflare usage API', () => {
  test('uses Cloudflare-safe Pages deployment pagination options', async () => {
    const app = createApp()
    const env = createTestEnv()
    const requestedUrls: string[] = []
    const graphqlQueries: string[] = []

    globalThis.fetch = (async (input, init) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
      requestedUrls.push(url)

      const parsed = new URL(url)
      if (parsed.pathname === '/client/v4/graphql') {
        graphqlQueries.push(String(init?.body ?? ''))
        return jsonResponse({
          data: {
            viewer: {
              accounts: [
                {
                  d1AnalyticsAdaptiveGroups: [],
                  d1StorageAdaptiveGroups: [],
                  pagesFunctionsInvocationsAdaptiveGroups: [
                    {
                      sum: {
                        errors: 1,
                        requests: 139,
                        subrequests: 4,
                      },
                      quantiles: {
                        cpuTimeP99: 8.5,
                      },
                    },
                  ],
                },
              ],
            },
          },
        })
      }

      if (parsed.pathname.endsWith('/pages/projects/edge-gist/deployments')) {
        return cloudflareResponse([
          {
            id: 'deployment-id',
            created_on: new Date().toISOString(),
            latest_stage: { status: 'success' },
            url: 'https://deployment.edge-gist.pages.dev',
          },
        ], {
          count: 1,
          page: 1,
          per_page: 20,
          total_count: 1,
          total_pages: 1,
        })
      }

      if (parsed.pathname.endsWith('/d1/database/database-id')) {
        return cloudflareResponse({
          name: 'edge-gist',
          file_size: 1024,
        })
      }

      if (parsed.pathname.endsWith('/pages/projects/edge-gist')) {
        return cloudflareResponse({
          id: 'project-id',
          name: 'edge-gist',
          production_script_name: 'pages-worker--edge-gist-production',
          production_branch: 'main',
          uses_functions: true,
        })
      }

      throw new Error(`Unexpected Cloudflare request: ${url}`)
    }) as typeof fetch

    await app.request(
      '/owner/_edgegist/api/cloudflare/settings',
      {
        method: 'PUT',
        headers: ownerHeaders(),
        body: JSON.stringify({
          accountId: 'account-id',
          apiToken: 'secret-token',
          pagesProjectName: 'edge-gist',
          d1DatabaseId: 'database-id',
          pagesPlan: 'free',
          d1Plan: 'free',
        }),
      },
      env,
    )

    const response = await app.request('/owner/_edgegist/api/cloudflare/usage?refresh=true', { headers: ownerHeaders() }, env)
    expect(response.status).toBe(200)
    const usage = await response.json() as Record<string, unknown>
    expect(usage.fetchedAt).toBeString()
    expect((usage.pages as Record<string, unknown>).functionsRequests).toBe(139)
    expect((usage.pages as Record<string, unknown>).functionsRequestLimit).toBe(100_000)
    expect((usage.pages as Record<string, unknown>).functionsRequestPercent).toBe(0.1)
    expect((usage.pages as Record<string, unknown>).functionsErrors).toBe(1)
    expect((usage.pages as Record<string, unknown>).functionsSubrequests).toBe(4)
    expect(graphqlQueries.some((body) => body.includes('pagesFunctionsInvocationsAdaptiveGroups'))).toBe(true)
    expect(graphqlQueries.some((body) => body.includes('workersInvocationsAdaptive'))).toBe(false)
    expect(graphqlQueries.some((body) => body.includes('pages-worker--edge-gist-production'))).toBe(true)

    const deploymentsUrl = requestedUrls.find((url) => url.includes('/pages/projects/edge-gist/deployments'))
    expect(deploymentsUrl).toBeDefined()
    expect(new URL(deploymentsUrl!).searchParams.get('page')).toBe('1')
    expect(new URL(deploymentsUrl!).searchParams.get('per_page')).toBe('20')
    expect(deploymentsUrl).not.toContain('per_page=100')

    requestedUrls.length = 0
    const cachedResponse = await app.request('/owner/_edgegist/api/cloudflare/usage', { headers: ownerHeaders() }, env)
    expect(cachedResponse.status).toBe(200)
    const cachedUsage = await cachedResponse.json() as Record<string, unknown>
    expect(cachedUsage.fetchedAt).toBe(usage.fetchedAt)
    expect(requestedUrls).toEqual([])
  })
})

function cloudflareResponse(result: unknown, resultInfo?: Record<string, unknown>): Response {
  return jsonResponse({
    errors: [],
    messages: [],
    result,
    result_info: resultInfo,
    success: true,
  })
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
  })
}
