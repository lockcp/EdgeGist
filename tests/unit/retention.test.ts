import { describe, expect, test } from 'bun:test'
import { selectVersionsToKeep } from '../../src/gists/retention'
import type { GistVersionFileChange, GistVersionRecord } from '../../src/gists/types'

describe('retention policy selection', () => {
  test('keeps latest N versions for each changed file', () => {
    const versions = [
      version('old-a', 1, '2026-05-01T00:00:00.000Z', [change('a.txt')]),
      version('middle-a', 2, '2026-05-02T00:00:00.000Z', [change('a.txt')]),
      version('new-a', 3, '2026-05-03T00:00:00.000Z', [change('a.txt')]),
      version('old-b', 4, '2026-05-04T00:00:00.000Z', [change('b.txt')]),
      version('middle-b', 5, '2026-05-05T00:00:00.000Z', [change('b.txt')]),
      version('new-b', 6, '2026-05-06T00:00:00.000Z', [change('b.txt')]),
    ]

    const keep = selectVersionsToKeep(versions, { count: 2 })

    expect(keep.map((item) => item.id)).toEqual(['new-b', 'middle-b', 'new-a', 'middle-a'])
  })

  test('keeps latest N file-change records for the gist feed', () => {
    const versions = [
      version('old-a', 1, '2026-05-01T00:00:00.000Z', [change('a.txt')]),
      version('new-a', 2, '2026-05-02T00:00:00.000Z', [change('a.txt')]),
      version('old-b', 3, '2026-05-03T00:00:00.000Z', [change('b.txt')]),
      version('new-b', 4, '2026-05-04T00:00:00.000Z', [change('b.txt')]),
    ]

    const keep = selectVersionsToKeep(versions, { count: 1 })

    expect(keep.map((item) => item.id)).toEqual(['new-b', 'new-a'])
  })

  test('keeps deletion boundary when a filename is recreated', () => {
    const versions = [
      version('old-a', 1, '2026-05-01T00:00:00.000Z', [change('a.txt')]),
      version('deleted-a', 2, '2026-05-02T00:00:00.000Z', [change('a.txt', 'deleted')]),
      version('recreated-a', 3, '2026-05-03T00:00:00.000Z', [change('a.txt', 'added')]),
      version('new-a', 4, '2026-05-04T00:00:00.000Z', [change('a.txt')]),
    ]

    const keep = selectVersionsToKeep(versions, { count: 2 })

    expect(keep.map((item) => item.id)).toEqual(['new-a', 'recreated-a', 'deleted-a'])
  })

  test('counts renamed file history under the same per-file limit', () => {
    const versions = [
      version('old-name', 1, '2026-05-01T00:00:00.000Z', [change('old.txt')]),
      version('renamed', 2, '2026-05-02T00:00:00.000Z', [change('new.txt', 'modified', 'old.txt')]),
      version('new-name-1', 3, '2026-05-03T00:00:00.000Z', [change('new.txt')]),
      version('new-name-2', 4, '2026-05-04T00:00:00.000Z', [change('new.txt')]),
    ]

    const keep = selectVersionsToKeep(versions, { count: 3 })

    expect(keep.map((item) => item.id)).toEqual(['new-name-2', 'new-name-1', 'renamed'])
  })

  test('keeps no historical versions when max versions is zero', () => {
    const versions = [
      version('old', 1, '2026-05-01T00:00:00.000Z'),
      version('new', 2, '2026-05-02T00:00:00.000Z'),
    ]

    const keep = selectVersionsToKeep(versions, { count: 0 })

    expect(keep).toEqual([])
  })
})

function version(
  id: string,
  index: number,
  committedAt: string,
  changes: GistVersionFileChange[] = [],
): GistVersionRecord {
  return {
    id,
    gistId: 'gist',
    sha: id,
    versionIndex: index,
    description: '',
    committedAt,
    changeStatus: { total: 0, additions: 0, deletions: 0 },
    files: [],
    changes,
  }
}

function change(
  filename: string,
  status: GistVersionFileChange['status'] = 'modified',
  previousFilename?: string,
): GistVersionFileChange {
  return {
    filename,
    previousFilename,
    status,
    additions: 1,
    deletions: 0,
  }
}
