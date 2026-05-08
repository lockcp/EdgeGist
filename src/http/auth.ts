import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import type { EdgeGistBindings, EdgeGistConfig } from '../env'
import { getConfig } from '../env'
import { unauthorized } from './errors'

const ownerSessionCookieName = 'edgegist_owner_session'
const defaultSessionMaxAgeSeconds = 60 * 60 * 12
const rememberedSessionMaxAgeSeconds = 60 * 60 * 24 * 30

export type AppVariables = {
  config: EdgeGistConfig
  isOwner: boolean
}

export type AppEnv = {
  Bindings: EdgeGistBindings
  Variables: AppVariables
}

export const configMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const config = getConfig(c.env, c.req.url)
  c.set('config', config)
  c.set('isOwner', await isOwnerRequest(c, config))
  await next()
}

export function requireOwner(c: Context<AppEnv>): void {
  if (!c.get('isOwner')) {
    throw unauthorized()
  }
}

export async function isOwnerRequest(c: Context<AppEnv>, config: EdgeGistConfig): Promise<boolean> {
  const auth = c.req.header('authorization')
  if (auth) {
    const bearer = auth.match(/^Bearer\s+(.+)$/i)
    if (bearer) return constantTimeStringEqual(bearer[1].trim(), config.ownerToken)

    const token = auth.match(/^token\s+(.+)$/i)
    if (token) return constantTimeStringEqual(token[1].trim(), config.ownerToken)
  }

  if (await hasOwnerSession(c, config)) return true

  return !config.turnstile && isOwnerBasicRequest(c, config)
}

export function requireOwnerPassword(c: Context<AppEnv>): void {
  if (!isOwnerBasicRequest(c, c.get('config'))) throw unauthorized()
}

export async function issueOwnerSession(c: Context<AppEnv>, remember: boolean): Promise<void> {
  const config = c.get('config')
  const maxAge = remember ? rememberedSessionMaxAgeSeconds : defaultSessionMaxAgeSeconds
  await setSignedCookie(c, ownerSessionCookieName, encodeSessionValue({
    exp: Math.floor(Date.now() / 1000) + maxAge,
    sub: config.ownerUsername,
  }), config.ownerToken, {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
  })
}

export function clearOwnerSession(c: Context<AppEnv>): void {
  deleteCookie(c, ownerSessionCookieName, { path: '/' })
}

function isOwnerBasicRequest(c: Context<AppEnv>, config: EdgeGistConfig): boolean {
  const auth = c.req.header('authorization')
  const basic = auth?.match(/^Basic\s+(.+)$/i)
  if (!basic) return false

  const decoded = decodeBasicAuth(basic[1].trim())
  if (!decoded) return false
  return (
    constantTimeStringEqual(decoded.username, config.ownerUsername) &&
    constantTimeStringEqual(decoded.password, config.ownerPassword)
  )
}

async function hasOwnerSession(c: Context<AppEnv>, config: EdgeGistConfig): Promise<boolean> {
  const value = await getSignedCookie(c, config.ownerToken, ownerSessionCookieName)
  if (!value) return false

  const session = decodeSessionValue(value)
  return Boolean(
    session &&
    session.sub === config.ownerUsername &&
    session.exp > Math.floor(Date.now() / 1000)
  )
}

function encodeSessionValue(payload: { sub: string; exp: number }): string {
  return btoa(JSON.stringify(payload))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function decodeSessionValue(value: string): { sub: string; exp: number } | null {
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const parsed = JSON.parse(atob(padded)) as Partial<{ sub: string; exp: number }>
    if (typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') return null
    return { sub: parsed.sub, exp: parsed.exp }
  } catch {
    return null
  }
}

function decodeBasicAuth(encoded: string): { username: string; password: string } | null {
  try {
    const decoded = atob(encoded)
    const separator = decoded.indexOf(':')
    if (separator === -1) return null
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    }
  } catch {
    return null
  }
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length)
  let result = left.length === right.length ? 0 : 1
  for (let index = 0; index < maxLength; index += 1) {
    result |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return result === 0
}
