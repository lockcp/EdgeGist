export type CompatibilityStatus = 'full' | 'mock' | 'unsupported'

export type CompatibilityEntry = {
  method: string
  path: string
  status: CompatibilityStatus
  notes: string
}

export const compatibilityMatrix: CompatibilityEntry[] = [
  { method: 'GET', path: '/gists', status: 'full', notes: 'Owner list with token; public-only when anonymous.' },
  { method: 'GET', path: '/gists/public', status: 'full', notes: 'Public gists only.' },
  { method: 'GET', path: '/users/{username}/gists', status: 'full', notes: 'Owner user supported.' },
  { method: 'POST', path: '/gists', status: 'full', notes: 'Create gist files.' },
  { method: 'GET', path: '/gists/{gist_id}', status: 'full', notes: 'Public/secret anonymous read by direct URL.' },
  { method: 'PATCH', path: '/gists/{gist_id}', status: 'full', notes: 'Description, visibility, file update, delete, and rename.' },
  { method: 'DELETE', path: '/gists/{gist_id}', status: 'full', notes: 'Deletes gist data.' },
  { method: 'GET', path: '/gists/{gist_id}/raw/{filename}', status: 'full', notes: 'EdgeGist raw file URL used by response payloads.' },
  { method: 'GET', path: '/gists/{gist_id}/raw/{sha}/{filename}', status: 'full', notes: 'Reads retained raw file content when the current gist is readable.' },
  { method: 'GET', path: '/gists/{gist_id}/commits', status: 'full', notes: 'Backed by retained snapshots, not git.' },
  { method: 'GET', path: '/gists/{gist_id}/{sha}', status: 'full', notes: 'Reads a retained snapshot.' },
  { method: 'GET', path: '/gists/starred', status: 'full', notes: 'Lists starred gists for the configured owner.' },
  { method: 'GET', path: '/gists/{gist_id}/star', status: 'full', notes: 'Returns 204 when starred, 404 when not starred.' },
  { method: 'PUT', path: '/gists/{gist_id}/star', status: 'full', notes: 'Stars a gist.' },
  { method: 'DELETE', path: '/gists/{gist_id}/star', status: 'full', notes: 'Unstars a gist.' },
  { method: 'GET', path: '/gists/{gist_id}/forks', status: 'mock', notes: 'Always empty.' },
  { method: 'POST', path: '/gists/{gist_id}/forks', status: 'mock', notes: 'No real fork created.' },
  { method: 'GET', path: '/gists/{gist_id}/comments', status: 'mock', notes: 'Always empty.' },
  { method: 'POST', path: '/gists/{gist_id}/comments', status: 'mock', notes: 'No real comment created.' },
  { method: 'GET', path: '/gists/{gist_id}/comments/{comment_id}', status: 'mock', notes: 'No comments exist.' },
  { method: 'PATCH', path: '/gists/{gist_id}/comments/{comment_id}', status: 'mock', notes: 'No real comment updated.' },
  { method: 'DELETE', path: '/gists/{gist_id}/comments/{comment_id}', status: 'mock', notes: 'No real comment deleted.' },
  { method: 'GIT', path: 'git clone/push/pull', status: 'unsupported', notes: 'Out of product scope.' },
]

export function compatibilityStatus(method: string, path: string): CompatibilityEntry | null {
  return (
    compatibilityMatrix.find(
      (entry) => entry.method === method.toUpperCase() && entry.path === path,
    ) ?? null
  )
}
