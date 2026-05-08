import type { D1DatabaseLike } from '../env'
import type {
  ChangeStatus,
  CreateGistInput,
  GistFileRecord,
  GistRecord,
  GistRepository,
  GistVersionFileChange,
  GistVersionRecord,
  GistVisibility,
  ListGistsOptions,
  UpdateGistInput,
} from './types'

type GistRow = {
  id: string
  owner_login: string
  description: string
  visibility: GistVisibility
  starred_at: string | null
  created_at: string
  updated_at: string
}

type GistFileRow = {
  filename: string
  content: string
  type: string | null
  language: string | null
  size: number
  truncated: number
  created_at: string
  updated_at: string
}

type VersionRow = {
  id: string
  gist_id: string
  sha: string
  version_index: number
  description: string
  committed_at: string
  change_status_total: number
  change_status_additions: number
  change_status_deletions: number
}

type VersionFileRow = {
  filename: string
  content: string
  type: string | null
  language: string | null
  size: number
  truncated: number
}

type VersionFileChangeRow = {
  filename: string
  previous_filename: string | null
  status: GistVersionFileChange['status']
  additions: number
  deletions: number
}

export class D1GistRepository implements GistRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async createGist(input: CreateGistInput): Promise<GistRecord> {
    const gist: GistRecord = {
      id: createId(20),
      ownerLogin: input.ownerLogin,
      description: input.description,
      visibility: input.visibility,
      starredAt: null,
      createdAt: input.now,
      updatedAt: input.now,
      files: input.files.map((file) => normalizeFile(file.filename, file.content, input.now, file)),
    }

    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO gists (id, owner_login, description, visibility, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          gist.id,
          gist.ownerLogin,
          gist.description,
          gist.visibility,
          gist.createdAt,
          gist.updatedAt,
        ),
      ...gist.files.map((file) => this.insertFileStatement(gist.id, file)),
    ])

    return gist
  }

  async getGist(id: string): Promise<GistRecord | null> {
    const gist = await this.db
      .prepare(
        `SELECT id, owner_login, description, visibility, starred_at, created_at, updated_at
         FROM gists
         WHERE id = ?`,
      )
      .bind(id)
      .first<GistRow>()

    if (!gist) return null
    return this.hydrateGist(gist)
  }

  async listGists(options: ListGistsOptions, includeContent = true): Promise<GistRecord[]> {
    const filter = buildGistListFilter(options)
    const args = [...filter.args, options.limit, options.offset]

    const query = `
      SELECT id, owner_login, description, visibility, starred_at, created_at, updated_at
      FROM gists
      ${filter.whereSql}
      ${gistListOrderBy(options)}
      LIMIT ? OFFSET ?
    `

    const rows = await this.db.prepare(query).bind(...args).all<GistRow>()
    return Promise.all((rows.results ?? []).map((row) => this.hydrateGist(row, includeContent)))
  }

  async countGists(options: ListGistsOptions): Promise<number> {
    const filter = buildGistListFilter(options)
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM gists
         ${filter.whereSql}`,
      )
      .bind(...filter.args)
      .first<{ count: number }>()

    return Number(row?.count ?? 0)
  }

  async updateGist(id: string, input: UpdateGistInput): Promise<GistRecord | null> {
    const existing = await this.getGist(id)
    if (!existing) return null

    const nextFiles = applyFileUpdates(existing.files, input.files ?? [], input.now)
    const description = input.description ?? existing.description
    const visibility = input.visibility ?? existing.visibility

    await this.db.batch([
      this.db
        .prepare(
          `UPDATE gists
           SET description = ?, visibility = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(description, visibility, input.now, id),
      this.db.prepare('DELETE FROM gist_files WHERE gist_id = ?').bind(id),
      ...nextFiles.map((file) => this.insertFileStatement(id, file)),
    ])

    return {
      ...existing,
      description,
      visibility,
      updatedAt: input.now,
      files: nextFiles,
    }
  }

  async deleteGist(id: string): Promise<boolean> {
    const existing = await this.getGist(id)
    if (!existing) return false
    await this.db.prepare('DELETE FROM gists WHERE id = ?').bind(id).run()
    return true
  }

  async setGistStarred(id: string, starredAt: string | null): Promise<GistRecord | null> {
    const existing = await this.getGist(id)
    if (!existing) return null

    await this.db
      .prepare('UPDATE gists SET starred_at = ? WHERE id = ?')
      .bind(starredAt, id)
      .run()

    return {
      ...existing,
      starredAt,
    }
  }

  async createVersion(
    gist: GistRecord,
    changeStatus: ChangeStatus,
    changes: GistVersionFileChange[],
  ): Promise<GistVersionRecord> {
    const current = await this.db
      .prepare('SELECT COUNT(*) AS count FROM gist_versions WHERE gist_id = ?')
      .bind(gist.id)
      .first<{ count: number }>()

    const version: GistVersionRecord = {
      id: createId(20),
      gistId: gist.id,
      sha: createId(40),
      versionIndex: Number(current?.count ?? 0) + 1,
      description: gist.description,
      committedAt: gist.updatedAt,
      changeStatus,
      files: gist.files,
      changes,
    }

    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO gist_versions (
             id, gist_id, sha, version_index, description, committed_at,
             change_status_total, change_status_additions, change_status_deletions
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          version.id,
          version.gistId,
          version.sha,
          version.versionIndex,
          version.description,
          version.committedAt,
          version.changeStatus.total,
          version.changeStatus.additions,
          version.changeStatus.deletions,
        ),
      ...version.files.map((file) =>
        this.db
          .prepare(
            `INSERT INTO gist_version_files (
               version_id, filename, content, type, language, size, truncated
             )
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            version.id,
            file.filename,
            file.content,
            file.type,
            file.language,
            file.size,
            file.truncated ? 1 : 0,
          ),
      ),
      ...version.changes.map((change) =>
        this.db
          .prepare(
            `INSERT INTO gist_version_changes (
               version_id, filename, previous_filename, status, additions, deletions
             )
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            version.id,
            change.filename,
            change.previousFilename ?? null,
            change.status,
            change.additions,
            change.deletions,
          ),
      ),
    ])

    return version
  }

  async listVersions(gistId: string): Promise<GistVersionRecord[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, gist_id, sha, version_index, description, committed_at,
                change_status_total, change_status_additions, change_status_deletions
         FROM gist_versions
         WHERE gist_id = ?
         ORDER BY committed_at DESC, version_index DESC`,
      )
      .bind(gistId)
      .all<VersionRow>()

    return Promise.all((rows.results ?? []).map((row) => this.hydrateVersion(row)))
  }

  async getVersion(gistId: string, sha: string): Promise<GistVersionRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, gist_id, sha, version_index, description, committed_at,
                change_status_total, change_status_additions, change_status_deletions
         FROM gist_versions
         WHERE gist_id = ? AND sha = ?`,
      )
      .bind(gistId, sha)
      .first<VersionRow>()

    if (!row) return null
    return this.hydrateVersion(row)
  }

  async pruneVersions(gistId: string, keepVersionIds: string[]): Promise<void> {
    const allVersions = await this.listVersions(gistId)
    const keep = new Set(keepVersionIds)
    const toDelete = allVersions.filter((version) => !keep.has(version.id))
    if (toDelete.length === 0) return

    await this.db.batch(
      toDelete.map((version) =>
        this.db.prepare('DELETE FROM gist_versions WHERE id = ?').bind(version.id),
      ),
    )
  }

  private insertFileStatement(gistId: string, file: GistFileRecord) {
    return this.db
      .prepare(
        `INSERT INTO gist_files (
           gist_id, filename, content, type, language, size, truncated, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        gistId,
        file.filename,
        file.content,
        file.type,
        file.language,
        file.size,
        file.truncated ? 1 : 0,
        file.createdAt,
        file.updatedAt,
      )
  }

  private async hydrateGist(row: GistRow, includeContent = true): Promise<GistRecord> {
    const contentSelection = includeContent ? 'content' : "'' AS content"
    const files = await this.db
      .prepare(
        `SELECT filename, ${contentSelection}, type, language, size, truncated, created_at, updated_at
         FROM gist_files
         WHERE gist_id = ?
         ORDER BY filename ASC`,
      )
      .bind(row.id)
      .all<GistFileRow>()

    return {
      id: row.id,
      ownerLogin: row.owner_login,
      description: row.description,
      visibility: row.visibility,
      starredAt: row.starred_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      files: (files.results ?? []).map(fileFromRow),
    }
  }

  private async hydrateVersion(row: VersionRow): Promise<GistVersionRecord> {
    const files = await this.db
      .prepare(
        `SELECT filename, content, type, language, size, truncated
         FROM gist_version_files
         WHERE version_id = ?
         ORDER BY filename ASC`,
      )
      .bind(row.id)
      .all<VersionFileRow>()

    const changes = await this.db
      .prepare(
        `SELECT filename, previous_filename, status, additions, deletions
         FROM gist_version_changes
         WHERE version_id = ?
         ORDER BY filename ASC`,
      )
      .bind(row.id)
      .all<VersionFileChangeRow>()

    return {
      id: row.id,
      gistId: row.gist_id,
      sha: row.sha,
      versionIndex: row.version_index,
      description: row.description,
      committedAt: row.committed_at,
      changeStatus: {
        total: row.change_status_total,
        additions: row.change_status_additions,
        deletions: row.change_status_deletions,
      },
      files: (files.results ?? []).map((file) => ({
        filename: file.filename,
        content: file.content,
        type: file.type,
        language: file.language,
        size: file.size,
        truncated: file.truncated === 1,
        createdAt: row.committed_at,
        updatedAt: row.committed_at,
      })),
      changes: (changes.results ?? []).map(versionFileChangeFromRow),
    }
  }
}

function buildGistListFilter(options: ListGistsOptions): { whereSql: string; args: unknown[] } {
  const where: string[] = []
  const args: unknown[] = []

  if (options.ownerLogin) {
    where.push('owner_login = ?')
    args.push(options.ownerLogin)
  }

  if (options.publicOnly) {
    where.push("visibility = 'public'")
  } else if (!options.includeSecret) {
    where.push("visibility = 'public'")
  }

  if (options.visibility) {
    where.push('visibility = ?')
    args.push(options.visibility)
  }

  if (options.since) {
    where.push('updated_at >= ?')
    args.push(options.since)
  }

  if (options.starredOnly) {
    where.push('starred_at IS NOT NULL')
  }

  const query = options.query?.trim()
  if (query) {
    const pattern = `%${escapeLikePattern(query)}%`
    where.push(`(
      gists.id LIKE ? ESCAPE '\\'
      OR gists.description LIKE ? ESCAPE '\\'
      OR EXISTS (
        SELECT 1
        FROM gist_files
        WHERE gist_files.gist_id = gists.id
          AND (
            gist_files.filename LIKE ? ESCAPE '\\'
            OR gist_files.content LIKE ? ESCAPE '\\'
          )
      )
    )`)
    args.push(pattern, pattern, pattern, pattern)
  }

  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    args,
  }
}

function gistListOrderBy(options: ListGistsOptions): string {
  const direction = options.direction === 'asc' ? 'ASC' : 'DESC'
  const stableDirection = direction

  if (options.sort === 'created') {
    return `ORDER BY created_at ${direction}, id ${stableDirection}`
  }

  if (options.sort === 'starred') {
    return `ORDER BY starred_at IS NULL ASC, starred_at ${direction}, updated_at DESC, id DESC`
  }

  return `ORDER BY updated_at ${direction}, id ${stableDirection}`
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function normalizeFile(
  filename: string,
  content: string,
  now: string,
  metadata: { type?: string | null; language?: string | null },
): GistFileRecord {
  return {
    filename,
    content,
    type: metadata.type ?? inferMimeType(filename),
    language: metadata.language ?? inferLanguage(filename),
    size: new TextEncoder().encode(content).length,
    truncated: false,
    createdAt: now,
    updatedAt: now,
  }
}

function fileFromRow(row: GistFileRow): GistFileRecord {
  return {
    filename: row.filename,
    content: row.content,
    type: row.type,
    language: row.language,
    size: row.size,
    truncated: row.truncated === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function versionFileChangeFromRow(row: VersionFileChangeRow): GistVersionFileChange {
  return {
    filename: row.filename,
    previousFilename: row.previous_filename,
    status: row.status,
    additions: row.additions,
    deletions: row.deletions,
  }
}

function applyFileUpdates(
  currentFiles: GistFileRecord[],
  updates: UpdateGistInput['files'],
  now: string,
): GistFileRecord[] {
  const currentFileByName = new Map(currentFiles.map((file) => [file.filename, file]))
  const removedFilenames = new Set<string>()

  for (const update of updates ?? []) {
    const existing = currentFileByName.get(update.previousFilename)
    if (update.delete || (existing && update.filename !== update.previousFilename)) {
      removedFilenames.add(update.previousFilename)
    }
  }

  const files = new Map(
    currentFiles
      .filter((file) => !removedFilenames.has(file.filename))
      .map((file) => [file.filename, file]),
  )

  for (const update of updates ?? []) {
    if (update.delete) continue

    const existing = currentFileByName.get(update.previousFilename)
    if (!existing && update.content === undefined) continue
    const filename = update.filename
    const content = update.content ?? existing?.content ?? ''
    const next = normalizeFile(filename, content, now, {
      type: update.type ?? existing?.type ?? undefined,
      language: update.language ?? existing?.language ?? undefined,
    })

    files.set(filename, {
      ...next,
      createdAt: existing?.createdAt ?? now,
    })
  }

  return Array.from(files.values()).sort((left, right) =>
    left.filename.localeCompare(right.filename),
  )
}

function inferMimeType(filename: string): string {
  if (filename.endsWith('.json')) return 'application/json'
  if (filename.endsWith('.md')) return 'text/markdown'
  if (filename.endsWith('.html')) return 'text/html'
  if (filename.endsWith('.js') || filename.endsWith('.ts')) return 'application/javascript'
  return 'text/plain'
}

function inferLanguage(filename: string): string | null {
  const extension = filename.split('.').pop()?.toLowerCase()
  const languages: Record<string, string> = {
    js: 'JavaScript',
    ts: 'TypeScript',
    json: 'JSON',
    md: 'Markdown',
    yaml: 'YAML',
    yml: 'YAML',
    html: 'HTML',
    css: 'CSS',
    txt: 'Text',
  }
  return extension ? languages[extension] ?? null : null
}

function createId(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2))
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length)
}
