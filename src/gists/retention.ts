import type { RetentionPolicy } from '../env'
import type {
  GistRepository,
  GistVersionRecord,
} from './types'

export async function applyRetention(
  repository: GistRepository,
  gistId: string,
  policy: RetentionPolicy,
): Promise<void> {
  const versions = await repository.listVersions(gistId)
  const keepVersionIds = selectVersionsToKeep(versions, policy).map((version) => version.id)
  await repository.pruneVersions(gistId, keepVersionIds)
}

export function selectVersionsToKeep(
  versions: GistVersionRecord[],
  policy: RetentionPolicy,
): GistVersionRecord[] {
  const sorted = [...versions].sort((left, right) => {
    const time = right.committedAt.localeCompare(left.committedAt)
    return time === 0 ? right.versionIndex - left.versionIndex : time
  })

  if (policy.count === 0) return []
  return selectLatestVersions(sorted, policy.count)
}

function selectLatestVersions(
  sortedVersions: GistVersionRecord[],
  count: number,
): GistVersionRecord[] {
  const changeCounts = new Map<string, number>()
  const renamedFileKeys = new Map<string, string>()
  const keepVersionIds = new Set<string>()
  const stoppedFiles = new Set<string>()
  let gistChangeCount = 0

  for (let index = 0; index < sortedVersions.length; index += 1) {
    const version = sortedVersions[index]
    const changes = version.changes
    let keepVersion = false

    for (const change of changes) {
      if (gistChangeCount >= count) break
      gistChangeCount += 1
      keepVersion = true
    }

    for (const change of changes) {
      const fileKey = renamedFileKeys.get(change.filename) ?? change.filename
      if (change.previousFilename) renamedFileKeys.set(change.previousFilename, fileKey)
      if (stoppedFiles.has(fileKey)) continue
      if (change.status === 'deleted') {
        if ((changeCounts.get(fileKey) ?? 0) > 0) keepVersion = true
        stoppedFiles.add(fileKey)
        continue
      }

      const fileCount = changeCounts.get(fileKey) ?? 0
      if (fileCount >= count) continue
      changeCounts.set(fileKey, fileCount + 1)
      keepVersion = true
    }

    if (keepVersion) keepVersionIds.add(version.id)
  }

  return sortedVersions.filter((version) => keepVersionIds.has(version.id))
}
