import type { D1DatabaseLike } from '../env'
import { badRequest } from '../http/errors'

const settingsKey = 'cloudflare'
const usageCacheKey = 'cloudflare_usage_cache'
const pagesDeploymentsPerPage = 20
const pagesDeploymentsPageLimit = 50

export type PagesPlan = 'free' | 'pro' | 'business' | 'enterprise'
export type D1Plan = 'free' | 'paid'

export type CloudflareSettings = {
  accountId: string
  apiToken: string
  pagesProjectName: string
  d1DatabaseId: string
  pagesPlan: PagesPlan
  d1Plan: D1Plan
}

export type PublicCloudflareSettings = Omit<CloudflareSettings, 'apiToken'> & {
  hasApiToken: boolean
}

export type CloudflareUsage = {
  fetchedAt: string
  settings: PublicCloudflareSettings
  pages: {
    projectName: string
    projectId: string | null
    productionBranch: string | null
    usesFunctions: boolean
    functionsScriptName: string | null
    functionsRequests: number | null
    functionsRequestLimit: number | null
    functionsRequestPercent: number | null
    functionsErrors: number | null
    functionsSubrequests: number | null
    functionsCpuTimeP99Ms: number | null
    functionsWindowStart: string | null
    functionsWindowEnd: string | null
    latestDeployment: {
      id: string | null
      url: string | null
      createdOn: string | null
      status: string | null
    }
    deploymentsThisMonth: number
    deploymentLimit: number | null
    deploymentPercent: number | null
  }
  d1: {
    databaseId: string
    databaseName: string | null
    rowsRead: number
    rowsWritten: number
    readQueries: number
    writeQueries: number
    storageBytes: number | null
    storageLimitBytes: number | null
    storagePercent: number | null
    rowsReadLimit: number | null
    rowsReadPercent: number | null
    rowsWrittenLimit: number | null
    rowsWrittenPercent: number | null
    queryLatencyP90Ms: number | null
    windowStart: string
    windowEnd: string
  }
}

export async function readCloudflareSettings(db: D1DatabaseLike): Promise<CloudflareSettings | null> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(settingsKey)
    .first<{ value: string }>()
  if (!row) return null

  try {
    const parsed = JSON.parse(row.value) as Partial<CloudflareSettings>
    return normalizeSettings(parsed, parsed.apiToken ?? '')
  } catch {
    return null
  }
}

export async function saveCloudflareSettings(
  db: D1DatabaseLike,
  payload: unknown,
): Promise<PublicCloudflareSettings> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw badRequest('Cloudflare settings must be an object')
  }

  const existing = await readCloudflareSettings(db)
  const incoming = payload as Partial<CloudflareSettings>
  const apiToken = incoming.apiToken?.trim() || existing?.apiToken || ''
  const next = normalizeSettings(
    {
      accountId: incoming.accountId,
      pagesProjectName: incoming.pagesProjectName,
      d1DatabaseId: incoming.d1DatabaseId,
      pagesPlan: incoming.pagesPlan ?? existing?.pagesPlan,
      d1Plan: incoming.d1Plan ?? existing?.d1Plan,
    },
    apiToken,
  )

  if (!next.accountId || !next.pagesProjectName || !next.d1DatabaseId) {
    throw badRequest('Account ID, Pages project name, and D1 database ID are required')
  }

  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(settingsKey, JSON.stringify(next), new Date().toISOString())
    .run()
  await db.prepare('DELETE FROM settings WHERE key = ?').bind(usageCacheKey).run()

  return publicSettings(next)
}

export async function readCachedCloudflareUsage(db: D1DatabaseLike): Promise<CloudflareUsage | null> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(usageCacheKey)
    .first<{ value: string }>()
  if (!row) return null

  try {
    const parsed = JSON.parse(row.value) as CloudflareUsage
    return typeof parsed.fetchedAt === 'string' ? parsed : null
  } catch {
    return null
  }
}

export async function getCloudflareUsage(db: D1DatabaseLike): Promise<CloudflareUsage> {
  const settings = await readCloudflareSettings(db)
  if (!settings || !settings.apiToken || !settings.accountId || !settings.pagesProjectName || !settings.d1DatabaseId) {
    throw badRequest('Cloudflare settings are incomplete')
  }

  const accountId = encodeURIComponent(settings.accountId)
  const pagesProjectName = encodeURIComponent(settings.pagesProjectName)
  const d1DatabaseId = encodeURIComponent(settings.d1DatabaseId)
  const project = await cloudflareRequest<Record<string, unknown>>(
    settings,
    `/accounts/${accountId}/pages/projects/${pagesProjectName}`,
  )
  const functionsScriptName = stringField(project, 'production_script_name')
  const [deployments, database, d1Analytics, functionsAnalytics] = await Promise.all([
    listPagesDeployments(settings),
    cloudflareRequest<Record<string, unknown>>(settings, `/accounts/${accountId}/d1/database/${d1DatabaseId}`).catch(() => null),
    fetchD1Analytics(settings),
    fetchPagesFunctionsRequestsAnalytics(settings, functionsScriptName).catch(() => null),
  ])

  const pagesPlan = pagesPlanLimits(settings.pagesPlan)
  const d1Plan = d1PlanLimits(settings.d1Plan)
  const workersPlan = workersPlanLimits(settings.d1Plan)
  const deploymentsThisMonth = deployments.filter((deployment) =>
    isInCurrentUtcMonth(stringField(deployment, 'created_on') ?? stringField(deployment, 'modified_on')),
  ).length
  const latest = deployments[0] ?? objectField(project, 'latest_deployment')
  const storageBytes = numberField(database, 'file_size') ?? d1Analytics.storageBytes
  const storageLimitBytes = d1Plan.databaseSizeBytes

  const usage: CloudflareUsage = {
    fetchedAt: new Date().toISOString(),
    settings: publicSettings(settings),
    pages: {
      projectName: settings.pagesProjectName,
      projectId: stringField(project, 'id'),
      productionBranch: stringField(project, 'production_branch'),
      usesFunctions: Boolean(project.uses_functions),
      functionsScriptName,
      functionsRequests: functionsAnalytics?.requests ?? null,
      functionsRequestLimit: workersPlan.requests,
      functionsRequestPercent: functionsAnalytics
        ? ratioPercent(functionsAnalytics.requests, workersPlan.requests)
        : null,
      functionsErrors: functionsAnalytics?.errors ?? null,
      functionsSubrequests: functionsAnalytics?.subrequests ?? null,
      functionsCpuTimeP99Ms: functionsAnalytics?.cpuTimeP99Ms ?? null,
      functionsWindowStart: functionsAnalytics?.windowStart ?? null,
      functionsWindowEnd: functionsAnalytics?.windowEnd ?? null,
      latestDeployment: {
        id: stringField(latest, 'id'),
        url: deploymentUrl(latest),
        createdOn: stringField(latest, 'created_on') ?? stringField(latest, 'modified_on'),
        status: stringField(objectField(latest, 'latest_stage'), 'status'),
      },
      deploymentsThisMonth,
      deploymentLimit: pagesPlan.buildsPerMonth,
      deploymentPercent: pagesPlan.buildsPerMonth ? ratioPercent(deploymentsThisMonth, pagesPlan.buildsPerMonth) : null,
    },
    d1: {
      databaseId: settings.d1DatabaseId,
      databaseName: stringField(database, 'name'),
      rowsRead: d1Analytics.rowsRead,
      rowsWritten: d1Analytics.rowsWritten,
      readQueries: d1Analytics.readQueries,
      writeQueries: d1Analytics.writeQueries,
      storageBytes,
      storageLimitBytes,
      storagePercent: storageBytes === null ? null : ratioPercent(storageBytes, storageLimitBytes),
      rowsReadLimit: d1Plan.rowsRead,
      rowsReadPercent: ratioPercent(d1Analytics.rowsRead, d1Plan.rowsRead),
      rowsWrittenLimit: d1Plan.rowsWritten,
      rowsWrittenPercent: ratioPercent(d1Analytics.rowsWritten, d1Plan.rowsWritten),
      queryLatencyP90Ms: d1Analytics.queryLatencyP90Ms,
      windowStart: d1Analytics.windowStart,
      windowEnd: d1Analytics.windowEnd,
    },
  }

  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(usageCacheKey, JSON.stringify(usage), usage.fetchedAt)
    .run()

  return usage
}

async function listPagesDeployments(settings: CloudflareSettings): Promise<Record<string, unknown>[]> {
  const deployments: Record<string, unknown>[] = []
  const accountId = encodeURIComponent(settings.accountId)
  const pagesProjectName = encodeURIComponent(settings.pagesProjectName)
  for (let page = 1; page <= pagesDeploymentsPageLimit; page += 1) {
    const batch = await cloudflareRequest<Record<string, unknown>[]>(
      settings,
      `/accounts/${accountId}/pages/projects/${pagesProjectName}/deployments?page=${page}&per_page=${pagesDeploymentsPerPage}`,
    )
    deployments.push(...batch)
    if (batch.length < pagesDeploymentsPerPage) break
  }
  return deployments
}

async function fetchPagesFunctionsRequestsAnalytics(settings: CloudflareSettings, scriptName: string | null) {
  const end = new Date()
  const start =
    settings.d1Plan === 'free'
      ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  const scriptFilter = scriptName ? 'scriptName: $scriptName,' : ''
  const scriptVariable = scriptName ? '$scriptName: string,' : ''
  const variables = {
    accountTag: settings.accountId,
    datetimeStart: start.toISOString(),
    datetimeEnd: end.toISOString(),
    ...(scriptName ? { scriptName } : {}),
  }
  const query = `
    query EdgeGistPagesFunctionsRequestsUsage(
      $accountTag: string,
      ${scriptVariable}
      $datetimeStart: string,
      $datetimeEnd: string
    ) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          pagesFunctionsInvocationsAdaptiveGroups(
            limit: 10000
            filter: {
              ${scriptFilter}
              datetime_geq: $datetimeStart,
              datetime_leq: $datetimeEnd
            }
          ) {
            sum {
              requests
              errors
              subrequests
            }
            quantiles {
              cpuTimeP99
            }
          }
        }
      }
    }
  `

  const payload = await cloudflareGraphqlRequest(settings, query, variables)
  const account = payload?.data?.viewer?.accounts?.[0]
  const analytics = Array.isArray(account?.pagesFunctionsInvocationsAdaptiveGroups)
    ? account.pagesFunctionsInvocationsAdaptiveGroups
    : []

  return {
    requests: sumField(analytics, 'sum', 'requests'),
    errors: sumField(analytics, 'sum', 'errors'),
    subrequests: sumField(analytics, 'sum', 'subrequests'),
    cpuTimeP99Ms: maxField(analytics, 'quantiles', 'cpuTimeP99'),
    windowStart: variables.datetimeStart,
    windowEnd: variables.datetimeEnd,
  }
}

async function fetchD1Analytics(settings: CloudflareSettings) {
  const end = new Date()
  const start =
    settings.d1Plan === 'free'
      ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  const variables = {
    accountTag: settings.accountId,
    databaseId: settings.d1DatabaseId,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
  const query = `
    query EdgeGistD1Usage($accountTag: string!, $start: Date, $end: Date, $databaseId: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          d1AnalyticsAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $start, date_leq: $end, databaseId: $databaseId }
          ) {
            sum {
              readQueries
              writeQueries
              rowsRead
              rowsWritten
              queryBatchResponseBytes
            }
            quantiles {
              queryBatchTimeMsP90
            }
          }
          d1StorageAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $start, date_leq: $end, databaseId: $databaseId }
          ) {
            max {
              databaseSizeBytes
            }
          }
        }
      }
    }
  `

  const payload = await cloudflareGraphqlRequest(settings, query, variables)
  const account = payload?.data?.viewer?.accounts?.[0]
  const analytics = Array.isArray(account?.d1AnalyticsAdaptiveGroups)
    ? account.d1AnalyticsAdaptiveGroups
    : []
  const storage = Array.isArray(account?.d1StorageAdaptiveGroups)
    ? account.d1StorageAdaptiveGroups
    : []

  return {
    rowsRead: sumField(analytics, 'sum', 'rowsRead'),
    rowsWritten: sumField(analytics, 'sum', 'rowsWritten'),
    readQueries: sumField(analytics, 'sum', 'readQueries'),
    writeQueries: sumField(analytics, 'sum', 'writeQueries'),
    queryLatencyP90Ms: maxField(analytics, 'quantiles', 'queryBatchTimeMsP90'),
    storageBytes: maxField(storage, 'max', 'databaseSizeBytes'),
    windowStart: variables.start,
    windowEnd: variables.end,
  }
}

async function cloudflareRequest<T>(settings: CloudflareSettings, path: string): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: {
      authorization: `Bearer ${settings.apiToken}`,
      accept: 'application/json',
    },
  })
  const payload = await response.json().catch(() => null) as CloudflareApiResponse<T> | null
  if (!response.ok || !payload?.success) {
    throw badRequest(cloudflareErrorMessage(payload, response.status))
  }
  return payload.result
}

async function cloudflareGraphqlRequest(
  settings: CloudflareSettings,
  query: string,
  variables: Record<string, unknown>,
): Promise<any> {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${settings.apiToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json().catch(() => null) as any
  if (!response.ok || payload?.errors?.length) {
    throw badRequest(payload?.errors?.[0]?.message ?? `Cloudflare GraphQL request failed with ${response.status}`)
  }
  return payload
}

type CloudflareApiResponse<T> = {
  success: boolean
  result: T
  errors?: Array<{ message?: string }>
}

function normalizeSettings(payload: Partial<CloudflareSettings>, apiToken: string): CloudflareSettings {
  return {
    accountId: payload.accountId?.trim() ?? '',
    apiToken: apiToken.trim(),
    pagesProjectName: payload.pagesProjectName?.trim() ?? '',
    d1DatabaseId: payload.d1DatabaseId?.trim() ?? '',
    pagesPlan: isPagesPlan(payload.pagesPlan) ? payload.pagesPlan : 'free',
    d1Plan: isD1Plan(payload.d1Plan) ? payload.d1Plan : 'free',
  }
}

function publicSettings(settings: CloudflareSettings): PublicCloudflareSettings {
  return {
    accountId: settings.accountId,
    hasApiToken: Boolean(settings.apiToken),
    pagesProjectName: settings.pagesProjectName,
    d1DatabaseId: settings.d1DatabaseId,
    pagesPlan: settings.pagesPlan,
    d1Plan: settings.d1Plan,
  }
}

function pagesPlanLimits(plan: PagesPlan) {
  if (plan === 'pro') return { buildsPerMonth: 5000 }
  if (plan === 'business') return { buildsPerMonth: 20000 }
  if (plan === 'enterprise') return { buildsPerMonth: null }
  return { buildsPerMonth: 500 }
}

function isPagesPlan(value: unknown): value is PagesPlan {
  return value === 'free' || value === 'pro' || value === 'business' || value === 'enterprise'
}

function workersPlanLimits(plan: D1Plan) {
  return {
    requests: plan === 'paid' ? 10_000_000 : 100_000,
  }
}

function d1PlanLimits(plan: D1Plan) {
  if (plan === 'paid') {
    return {
      rowsRead: 25_000_000_000,
      rowsWritten: 50_000_000,
      databaseSizeBytes: 10 * 1024 * 1024 * 1024,
    }
  }

  return {
    rowsRead: 5_000_000,
    rowsWritten: 100_000,
    databaseSizeBytes: 500 * 1024 * 1024,
  }
}

function isD1Plan(value: unknown): value is D1Plan {
  return value === 'free' || value === 'paid'
}

function isInCurrentUtcMonth(value: string | null): boolean {
  if (!value) return false
  const date = new Date(value)
  const now = new Date()
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth()
}

function stringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== 'object') return null
  const candidate = (value as Record<string, unknown>)[field]
  return typeof candidate === 'string' ? candidate : null
}

function objectField(value: unknown, field: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const candidate = (value as Record<string, unknown>)[field]
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null
}

function deploymentUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const aliases = (value as Record<string, unknown>).aliases
  if (Array.isArray(aliases) && typeof aliases[0] === 'string') return aliases[0]
  return stringField(value, 'url')
}

function sumField(items: unknown[], group: string, field: string): number {
  return items.reduce<number>((total, item) => total + (numberField(objectField(item, group), field) ?? 0), 0)
}

function maxField(items: unknown[], group: string, field: string): number | null {
  let max: number | null = null
  for (const item of items) {
    const value = numberField(objectField(item, group), field)
    if (value === null) continue
    max = max === null ? value : Math.max(max, value)
  }
  return max
}

function numberField(value: unknown, field: string): number | null {
  if (!value || typeof value !== 'object') return null
  const candidate = (value as Record<string, unknown>)[field]
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
}

function ratioPercent(value: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((value / limit) * 1000) / 10)
}

function cloudflareErrorMessage(payload: CloudflareApiResponse<unknown> | null, status: number): string {
  return payload?.errors?.[0]?.message ?? `Cloudflare API request failed with ${status}`
}
