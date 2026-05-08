import { describe, expect, test } from 'bun:test'
import { compatibilityMatrix } from '../../src/gists/compatibility'

describe('compatibility matrix', () => {
  test('classifies core, mocked, and unsupported surfaces', () => {
    expect(compatibilityMatrix).toContainEqual(
      expect.objectContaining({ method: 'POST', path: '/gists', status: 'full' }),
    )
    expect(compatibilityMatrix).toContainEqual(
      expect.objectContaining({ method: 'GET', path: '/gists/{gist_id}/comments', status: 'mock' }),
    )
    expect(compatibilityMatrix).toContainEqual(
      expect.objectContaining({ method: 'GIT', status: 'unsupported' }),
    )
  })
})
