import type { Context } from 'hono'

export type ApiErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'internal_error'

const statusByCode: Record<ApiErrorCode, 400 | 401 | 403 | 404 | 500> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  internal_error: 500,
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: 400 | 401 | 403 | 404 | 500

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = statusByCode[code]
  }
}

export function badRequest(message: string): ApiError {
  return new ApiError('bad_request', message)
}

export function unauthorized(message = 'Requires authentication'): ApiError {
  return new ApiError('unauthorized', message)
}

export function forbidden(message = 'Resource not accessible'): ApiError {
  return new ApiError('forbidden', message)
}

export function notFound(message = 'Not Found'): ApiError {
  return new ApiError('not_found', message)
}

export function internalError(message = 'Internal Server Error'): ApiError {
  return new ApiError('internal_error', message)
}

export function renderApiError(c: Context, error: unknown): Response {
  const apiError = error instanceof ApiError ? error : internalError()
  return c.json(
    {
      message: apiError.message,
      documentation_url: 'https://docs.github.com/rest/gists/gists',
      status: `${apiError.status}`,
    },
    apiError.status,
  )
}
