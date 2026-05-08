export type AdminStatus = {
  name: string
  ok: boolean
  ownerUsername: string
  baseUrl: string
  retention: { count: number }
}

export type GistFile = {
  filename: string
  type: string
  language: string | null
  raw_url: string
  size: number
  truncated: boolean
  content?: string
}

export type GistHistoryItem = {
  url: string
  version: string
  change_status: {
    total: number
    additions: number
    deletions: number
  }
  files: GistHistoryFileChange[]
  committed_at: string
}

export type GistHistoryFileChange = {
  filename: string
  previous_filename?: string | null
  status: 'added' | 'modified' | 'deleted'
  additions: number
  deletions: number
}

export type GistSummary = {
  id: string
  description: string
  public: boolean
  visibility: 'public' | 'secret'
  starred: boolean
  starred_at: string | null
  created_at: string
  updated_at: string
  files: Record<string, GistFile>
  history?: GistHistoryItem[]
}

export type GistDetail = GistSummary & {
  files: Record<string, GistFile & { content: string }>
  history: GistHistoryItem[]
}

export type PagesPlan = 'free' | 'pro' | 'business' | 'enterprise'
export type D1Plan = 'free' | 'paid'

export type CloudflareSettings = {
  accountId: string
  hasApiToken: boolean
  pagesProjectName: string
  d1DatabaseId: string
  pagesPlan: PagesPlan
  d1Plan: D1Plan
}

export type CloudflareSettingsInput = Omit<CloudflareSettings, 'hasApiToken'> & {
  apiToken?: string
}

export type CloudflareUsage = {
  fetchedAt: string
  settings: CloudflareSettings
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

export type EdgeGistExportPayload = {
  format: 'edgegist.export.v1'
  exportedAt: string
  includeHistory: boolean
  settings?: unknown[]
  gists: unknown[]
}

export type ImportResult = {
  gistCount: number
  settingCount: number
  versionCount: number
}
