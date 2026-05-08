import { describe, expect, test } from 'bun:test'
import { exportEdgeGistData } from '../../src/app/data'
import type { D1PreparedStatement } from '../../src/env'
import { createMigratedTestD1 } from '../../src/testing/mock-d1'

describe('EdgeGist data export', () => {
  test('exports owner gists beyond the first repository page', async () => {
    const db = createMigratedTestD1()
    const now = '2026-05-09T00:00:00.000Z'
    const statements: D1PreparedStatement[] = []

    for (let index = 0; index < 1001; index += 1) {
      const id = `gist-${String(index).padStart(4, '0')}`
      statements.push(
        db
          .prepare(
            `INSERT INTO gists (
               id, owner_login, description, visibility, starred_at, created_at, updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, 'owner', `export ${index}`, 'secret', null, now, now),
      )
    }

    await db.batch(statements)

    const payload = await exportEdgeGistData(db, 'owner', false)

    expect(payload.gists).toHaveLength(1001)
    expect(payload.gists.map((gist) => gist.id)).toContain('gist-1000')
  })
})
