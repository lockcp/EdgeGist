import type { EdgeGistConfig } from '../env'

export function emptyForks(): unknown[] {
  return []
}

export function emptyComments(): unknown[] {
  return []
}

export function mockForkResponse(gistId: string, config: EdgeGistConfig): Record<string, unknown> {
  return {
    id: gistId,
    url: `${config.baseUrl}/gists/${gistId}`,
    owner: {
      login: config.ownerUsername,
    },
    public: false,
    comments: 0,
    forks: [],
    mocked: true,
  }
}

export function mockCommentResponse(config: EdgeGistConfig): Record<string, unknown> {
  return {
    id: 0,
    node_id: 'EG_COMMENT_MOCK',
    url: `${config.baseUrl}/gists/comments/0`,
    body: '',
    user: {
      login: config.ownerUsername,
    },
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    mocked: true,
  }
}
