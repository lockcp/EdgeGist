import { readdirSync, readFileSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import type { D1DatabaseLike, D1PreparedStatement, D1Result } from '../env'

export class SqliteD1Database implements D1DatabaseLike {
  constructor(private readonly sqlite: Database) {
    this.sqlite.run('PRAGMA foreign_keys = ON')
  }

  prepare(query: string): D1PreparedStatement {
    return new SqliteD1PreparedStatement(this.sqlite, query)
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return this.sqlite.transaction(() =>
      statements.map((statement) => {
        if (statement instanceof SqliteD1PreparedStatement) {
          return statement.runSync<T>()
        }
        throw new Error('SqliteD1Database can only batch SqliteD1PreparedStatement objects')
      }),
    )()
  }

  execute(sql: string): void {
    for (const statement of splitSql(sql)) {
      this.sqlite.run(statement)
    }
  }
}

class SqliteD1PreparedStatement implements D1PreparedStatement {
  constructor(
    private readonly sqlite: Database,
    private readonly query: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new SqliteD1PreparedStatement(this.sqlite, this.query, values)
  }

  async first<T = unknown>(): Promise<T | null> {
    return (this.sqlite.query(this.query).get(...(this.values as never[])) as T | null) ?? null
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    return {
      results: this.sqlite.query(this.query).all(...(this.values as never[])) as T[],
      success: true,
    }
  }

  async run(): Promise<D1Result> {
    return this.runSync()
  }

  runSync<T = unknown>(): D1Result<T> {
    const result = this.sqlite.query(this.query).run(...(this.values as never[]))
    return {
      success: true,
      meta: {
        changes: result.changes,
        last_row_id: result.lastInsertRowid,
      },
    }
  }
}

export function createMigratedTestD1(): SqliteD1Database {
  const db = new SqliteD1Database(new Database(':memory:'))
  for (const migration of readdirSync('migrations').filter((file) => file.endsWith('.sql')).sort()) {
    db.execute(readFileSync(`migrations/${migration}`, 'utf8'))
  }
  return db
}

function splitSql(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}
