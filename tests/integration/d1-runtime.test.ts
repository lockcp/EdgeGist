import { describe, expect, test } from 'bun:test'
import { D1GistRepository } from '../../src/gists/repository'
import { createMigratedTestD1 } from '../../src/testing/mock-d1'

describe('D1 repository runtime behavior', () => {
  test('applies migration and persists current gist files', async () => {
    const repository = new D1GistRepository(createMigratedTestD1())
    const now = '2026-05-08T00:00:00.000Z'
    const gist = await repository.createGist({
      ownerLogin: 'owner',
      description: 'runtime',
      visibility: 'secret',
      files: [{ filename: 'data.json', content: '{"ok":true}' }],
      now,
    })

    const found = await repository.getGist(gist.id)

    expect(found?.files[0]?.filename).toBe('data.json')
    expect(found?.files[0]?.content).toBe('{"ok":true}')
  })

  test('deletes versions outside the kept set', async () => {
    const repository = new D1GistRepository(createMigratedTestD1())
    const gist = await repository.createGist({
      ownerLogin: 'owner',
      description: '',
      visibility: 'secret',
      files: [{ filename: 'a.txt', content: 'a' }],
      now: '2026-05-08T00:00:00.000Z',
    })
    const first = await repository.createVersion(gist, { total: 0, additions: 0, deletions: 0 }, [])
    const second = await repository.createVersion(
      { ...gist, updatedAt: '2026-05-08T01:00:00.000Z' },
      { total: 1, additions: 1, deletions: 0 },
      [{ filename: 'a.txt', status: 'modified', additions: 1, deletions: 0 }],
    )

    await repository.pruneVersions(gist.id, [second.id])
    const versions = await repository.listVersions(gist.id)

    expect(versions.map((version) => version.id)).toEqual([second.id])
    expect(versions.some((version) => version.id === first.id)).toBe(false)
  })

  test('can list gist metadata without hydrating file content', async () => {
    const repository = new D1GistRepository(createMigratedTestD1())
    await repository.createGist({
      ownerLogin: 'owner',
      description: 'runtime',
      visibility: 'secret',
      files: [{ filename: 'data.json', content: '{"ok":true}' }],
      now: '2026-05-08T00:00:00.000Z',
    })

    const [summary] = await repository.listGists({
      ownerLogin: 'owner',
      includeSecret: true,
      limit: 10,
      offset: 0,
    }, false)
    const [full] = await repository.listGists({
      ownerLogin: 'owner',
      includeSecret: true,
      limit: 10,
      offset: 0,
    })

    expect(summary?.files[0]?.filename).toBe('data.json')
    expect(summary?.files[0]?.size).toBe(11)
    expect(summary?.files[0]?.content).toBe('')
    expect(full?.files[0]?.content).toBe('{"ok":true}')
  })
})
