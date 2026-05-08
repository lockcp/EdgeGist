import type { EdgeGistConfig } from '../env'
import type {
  GistFileRecord,
  GistRecord,
  GistVersionRecord,
} from './types'

type PresenterContext = {
  config: EdgeGistConfig
  includeContent?: boolean
  includeHistory?: boolean
  rawVersionSha?: string
  versions?: GistVersionRecord[]
}

type VersionPresenterContext = PresenterContext & {
  visibility: GistRecord['visibility']
}

export function presentGist(gist: GistRecord, context: PresenterContext): Record<string, unknown> {
  const base = context.config.baseUrl
  const ownerWebBase = ownerPath(base, context.config.ownerUsername)
  const owner = presentOwner(context.config.ownerUsername, base)
  const files = Object.fromEntries(
    gist.files.map((file) => [
      file.filename,
      presentFile(
        gist.id,
        file,
        base,
        context.includeContent !== false,
        context.config.ownerUsername,
        context.rawVersionSha,
      ),
    ]),
  )

  return {
    url: `${base}/gists/${gist.id}`,
    forks_url: `${base}/gists/${gist.id}/forks`,
    commits_url: `${base}/gists/${gist.id}/commits`,
    id: gist.id,
    node_id: `EG_${gist.id}`,
    git_pull_url: `${ownerWebBase}/${gist.id}.git`,
    git_push_url: `${ownerWebBase}/${gist.id}.git`,
    html_url: context.rawVersionSha
      ? `${ownerWebBase}/${gist.id}/${context.rawVersionSha}`
      : `${ownerWebBase}/${gist.id}`,
    files,
    public: gist.visibility === 'public',
    visibility: gist.visibility,
    starred: Boolean(gist.starredAt),
    starred_at: gist.starredAt,
    created_at: gist.createdAt,
    updated_at: gist.updatedAt,
    description: gist.description,
    comments: 0,
    user: null,
    comments_url: `${base}/gists/${gist.id}/comments`,
    owner,
    forks: [],
    forks_history: [],
    ...(context.includeHistory === false
      ? {}
      : { history: presentHistory(gist.id, context.versions ?? [], context) }),
    truncated: false,
  }
}

function presentHistory(
  gistId: string,
  versions: GistVersionRecord[],
  context: PresenterContext,
): Record<string, unknown>[] {
  return versions.map((version) => presentCommit(gistId, version, context))
}

export function presentCommit(
  gistId: string,
  version: GistVersionRecord,
  context: PresenterContext,
): Record<string, unknown> {
  const base = context.config.baseUrl
  return {
    url: `${base}/gists/${gistId}/${version.sha}`,
    version: version.sha,
    user: presentOwner(context.config.ownerUsername, base),
    change_status: version.changeStatus,
    files: presentChangedFiles(version),
    committed_at: version.committedAt,
  }
}

export function presentVersion(
  version: GistVersionRecord,
  context: VersionPresenterContext,
): Record<string, unknown> {
  return presentGist(
    {
      id: version.gistId,
      ownerLogin: context.config.ownerUsername,
      description: version.description,
      visibility: context.visibility,
      starredAt: null,
      createdAt: version.committedAt,
      updatedAt: version.committedAt,
      files: version.files,
    },
    {
      ...context,
      rawVersionSha: version.sha,
      versions: [version],
    },
  )
}

export function presentOwner(login: string, base: string): Record<string, unknown> {
  return {
    login,
    id: 1,
    node_id: `EG_USER_${login}`,
    avatar_url: `${base}/avatar/${encodeURIComponent(login)}`,
    gravatar_id: '',
    url: `${base}/users/${encodeURIComponent(login)}`,
    html_url: `${base}/${encodeURIComponent(login)}`,
    type: 'User',
    site_admin: true,
  }
}

function presentChangedFiles(version: GistVersionRecord): Array<Record<string, unknown>> {
  return version.changes.map((change) => ({
    filename: change.filename,
    ...(change.previousFilename ? { previous_filename: change.previousFilename } : {}),
    status: change.status,
    additions: change.additions,
    deletions: change.deletions,
  }))
}

export function presentFile(
  gistId: string,
  file: GistFileRecord,
  base: string,
  includeContent: boolean,
  ownerLogin: string,
  rawVersionSha?: string,
): Record<string, unknown> {
  const ownerWebBase = ownerPath(base, ownerLogin)
  const encodedFilename = encodeURIComponent(file.filename)
  const rawUrl = rawVersionSha
    ? `${ownerWebBase}/${gistId}/raw/${rawVersionSha}/${encodedFilename}`
    : `${ownerWebBase}/${gistId}/raw/${encodedFilename}`
  return {
    filename: file.filename,
    type: file.type ?? 'text/plain',
    language: file.language,
    raw_url: rawUrl,
    size: file.size,
    truncated: file.truncated,
    ...(includeContent ? { content: file.content } : {}),
  }
}

function ownerPath(base: string, ownerLogin: string): string {
  return `${base}/${encodeURIComponent(ownerLogin)}`
}
