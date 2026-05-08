import type { GistFileRecord, GistVersionFileChange } from './types'
import { diffLines } from 'diff'

export type FileRenameHint = {
  previousFilename: string
  filename: string
}

export function fileChangesForFiles(
  previous: GistFileRecord[],
  next: GistFileRecord[],
  renameHints: FileRenameHint[] = [],
): GistVersionFileChange[] {
  const previousFiles = new Map(previous.map((file) => [file.filename, file]))
  const nextFiles = new Map(next.map((file) => [file.filename, file]))
  const handledPreviousFilenames = new Set<string>()
  const handledNextFilenames = new Set<string>()

  const renameChanges = renameHints.flatMap((hint): GistVersionFileChange[] => {
    if (hint.previousFilename === hint.filename) return []

    const previousFile = previousFiles.get(hint.previousFilename)
    const nextFile = nextFiles.get(hint.filename)
    if (!previousFile || !nextFile) return []

    handledPreviousFilenames.add(hint.previousFilename)
    handledNextFilenames.add(hint.filename)

    const lineChanges = lineChangeCounts(previousFile.content, nextFile.content)
    return [{
      filename: hint.filename,
      previousFilename: hint.previousFilename,
      status: 'modified' as const,
      additions: lineChanges.additions,
      deletions: lineChanges.deletions,
    }]
  })

  const filenames = Array.from(new Set([...previousFiles.keys(), ...nextFiles.keys()]))
    .filter((filename) => !handledPreviousFilenames.has(filename) && !handledNextFilenames.has(filename))
    .sort()

  const directChanges = filenames.flatMap((filename): GistVersionFileChange[] => {
    const previousFile = previousFiles.get(filename)
    const nextFile = nextFiles.get(filename)
    if (!previousFile && nextFile) {
      return [{
        filename,
        status: 'added' as const,
        additions: countLines(nextFile.content),
        deletions: 0,
      }]
    }
    if (previousFile && !nextFile) {
      return [{
        filename,
        status: 'deleted' as const,
        additions: 0,
        deletions: countLines(previousFile.content),
      }]
    }
    if (previousFile && nextFile && previousFile.content !== nextFile.content) {
      const lineChanges = lineChangeCounts(previousFile.content, nextFile.content)
      return [{
        filename,
        status: 'modified' as const,
        additions: lineChanges.additions,
        deletions: lineChanges.deletions,
      }]
    }
    return []
  })

  return [...renameChanges, ...directChanges].sort((left, right) =>
    left.filename.localeCompare(right.filename),
  )
}

export function changeStatusForFileChanges(changes: GistVersionFileChange[]) {
  const additions = changes.reduce((total, change) => total + change.additions, 0)
  const deletions = changes.reduce((total, change) => total + change.deletions, 0)
  return {
    total: additions + deletions,
    additions,
    deletions,
  }
}

function lineChangeCounts(previous: string, next: string): { additions: number; deletions: number } {
  return diffLines(previous, next).reduce(
    (total, part) => ({
      additions: total.additions + (part.added ? countLines(part.value) : 0),
      deletions: total.deletions + (part.removed ? countLines(part.value) : 0),
    }),
    { additions: 0, deletions: 0 },
  )
}

function countLines(value: string): number {
  if (value.length === 0) return 0
  const lines = value.split('\n')
  return value.endsWith('\n') ? lines.length - 1 : lines.length
}
