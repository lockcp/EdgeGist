export type Pagination = {
  page: number
  perPage: number
  offset: number
  limit: number
}

export function parsePagination(searchParams: URLSearchParams): Pagination {
  const page = parseBoundedInteger(searchParams.get('page'), 1, 1, 10_000)
  const perPage = parseBoundedInteger(searchParams.get('per_page'), 30, 1, 100)
  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
    limit: perPage,
  }
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === null || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}
