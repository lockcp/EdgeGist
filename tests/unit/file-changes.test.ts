import { describe, expect, test } from 'bun:test'
import { changeStatusForFileChanges, fileChangesForFiles } from '../../src/gists/file-changes'
import type { GistFileRecord } from '../../src/gists/types'

describe('gist file change accounting', () => {
  test('counts same-size content replacements as line additions and deletions', () => {
    const changes = fileChangesForFiles(
      [file('config.txt', 'one\n')],
      [file('config.txt', 'two\n')],
    )

    expect(changes).toEqual([
      {
        filename: 'config.txt',
        status: 'modified',
        additions: 1,
        deletions: 1,
      },
    ])
    expect(changeStatusForFileChanges(changes)).toEqual({
      total: 2,
      additions: 1,
      deletions: 1,
    })
  })

  test('counts created and deleted files by lines instead of bytes', () => {
    const changes = fileChangesForFiles(
      [file('deleted.txt', 'old\nfile\n')],
      [file('added.txt', 'new\nfile\n')],
    )

    expect(changes).toEqual([
      {
        filename: 'added.txt',
        status: 'added',
        additions: 2,
        deletions: 0,
      },
      {
        filename: 'deleted.txt',
        status: 'deleted',
        additions: 0,
        deletions: 2,
      },
    ])
  })

  test('tracks renames as one file history change', () => {
    const changes = fileChangesForFiles(
      [file('old.txt', 'one\n')],
      [file('new.txt', 'two\n')],
      [{ previousFilename: 'old.txt', filename: 'new.txt' }],
    )

    expect(changes).toEqual([
      {
        filename: 'new.txt',
        previousFilename: 'old.txt',
        status: 'modified',
        additions: 1,
        deletions: 1,
      },
    ])
  })
})

function file(filename: string, content: string): GistFileRecord {
  return {
    filename,
    content,
    type: 'text/plain',
    language: 'Text',
    size: new TextEncoder().encode(content).length,
    truncated: false,
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
  }
}
