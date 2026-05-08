import type { Context } from 'hono'
import type { AppEnv } from './auth'
import { unauthorized } from './errors'

const siteverifyEndpoint = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type SiteverifyResponse = {
  success?: boolean
  'error-codes'?: string[]
}

export async function requireTurnstile(c: Context<AppEnv>): Promise<void> {
  const turnstile = c.get('config').turnstile
  if (!turnstile) return

  const token = c.req.header('x-edgegist-turnstile-token')?.trim() ?? ''
  if (!token || token.length > 2048) throw unauthorized('Verification failed')

  const remoteip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const response = await fetch(siteverifyEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      secret: turnstile.secretKey,
      response: token,
      ...(remoteip ? { remoteip } : {}),
    }),
  }).catch(() => null)

  if (!response?.ok) throw unauthorized('Verification failed')

  const result = await response.json().catch(() => null) as SiteverifyResponse | null
  if (!result?.success) throw unauthorized('Verification failed')
}
