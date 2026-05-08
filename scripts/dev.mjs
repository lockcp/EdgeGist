import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const host = process.env.HOST || '127.0.0.1'
const requestedPort = Number(process.env.PORT || '8787')
const prepareOnly = process.argv.includes('--prepare-only')
const serverOnly = process.argv.includes('--server-only')
const requiredNodeMajor = 22

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

async function main() {
  assertSupportedNode()
  const port = await findAvailablePort(host, requestedPort)
  const localBaseUrl = `http://${host}:${port}`
  if (port !== requestedPort) {
    console.log(`[edge-gist] Port ${requestedPort} is in use; using ${port}.`)
  }
  ensureWranglerConfig()
  ensureDevVars(localBaseUrl)

  if (!serverOnly) {
    console.log('[edge-gist] Applying local D1 migrations...')
    await run(process.execPath, [
      resolve('node_modules/wrangler/bin/wrangler.js'),
      'd1',
      'migrations',
      'apply',
      'edge-gist',
      '--local',
    ], { CI: 'true' })
  }

  if (prepareOnly) {
    console.log(`[edge-gist] Local dev is prepared. Run "bun run dev:server" and open ${localBaseUrl}/`)
    return
  }

  console.log(`[edge-gist] Starting local dev server at ${localBaseUrl}/`)
  await run(process.execPath, [
    resolve('node_modules/vite/bin/vite.js'),
    '--host',
    host,
    '--port',
    String(port),
    '--strictPort',
  ])
}

function assertSupportedNode() {
  const major = Number(process.versions.node.split('.')[0])
  if (Number.isFinite(major) && major >= requiredNodeMajor) return

  throw new Error([
    `[edge-gist] Local development requires Node.js >= ${requiredNodeMajor}. Current: ${process.version}.`,
    'This repository includes .node-version for mise/asdf-style version managers.',
    'With mise, run "mise install" in the repository, then reopen the shell or cd out and back in.',
  ].join('\n'))
}

function ensureWranglerConfig() {
  const configPath = resolve('wrangler.jsonc')
  if (existsSync(configPath)) return

  const examplePath = resolve('wrangler.example.jsonc')
  if (!existsSync(examplePath)) {
    throw new Error('[edge-gist] Missing wrangler.jsonc and wrangler.example.jsonc.')
  }

  writeFileSync(configPath, readFileSync(examplePath, 'utf8'))
  console.log('[edge-gist] Created local wrangler.jsonc from wrangler.example.jsonc.')
}

function ensureDevVars(localBaseUrl) {
  const path = resolve('.dev.vars')
  const defaults = [
    ['EDGEGIST_BASE_URL', localBaseUrl],
    ['EDGEGIST_TURNSTILE_SITE_KEY', ''],
    ['EDGEGIST_TURNSTILE_SECRET_KEY', ''],
  ]

  const current = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const lines = current.split(/\r?\n/)
  const existingKeys = new Set()
  let changed = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (!match) continue
    existingKeys.add(match[1])
    if (match[1] === 'EDGEGIST_BASE_URL' && shouldReplaceLocalBaseUrl(line)) {
      lines[index] = `EDGEGIST_BASE_URL=${localBaseUrl}`
      changed = true
    }
  }

  const missing = defaults.filter(([key]) => !existingKeys.has(key))
  if (missing.length === 0 && !changed) return

  const base = lines.join('\n').trimEnd()
  const additions = [
    '# Local EdgeGist development defaults.',
    ...missing.map(([key, value]) => `${key}=${value}`),
    '',
  ].join('\n')
  writeFileSync(path, base + (missing.length > 0 ? `${base ? '\n' : ''}${additions}` : '\n'))
  console.log('[edge-gist] Updated .dev.vars with local development defaults.')
}

function shouldReplaceLocalBaseUrl(line) {
  const value = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  return value === '' || value.startsWith('http://127.0.0.1:') || value.startsWith('http://localhost:')
}

async function findAvailablePort(hostname, startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(hostname, port)) return port
  }
  throw new Error(`[edge-gist] No available port found from ${startPort} to ${startPort + 19}.`)
}

function isPortAvailable(hostname, port) {
  return new Promise((resolvePromise) => {
    const server = createServer()
    server.once('error', () => resolvePromise(false))
    server.once('listening', () => {
      server.close(() => resolvePromise(true))
    })
    server.listen(port, hostname)
  })
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv,
      },
    })

    const forward = (signal) => {
      if (!child.killed) child.kill(signal)
    }
    process.once('SIGINT', forward)
    process.once('SIGTERM', forward)

    child.on('exit', (code, signal) => {
      process.removeListener('SIGINT', forward)
      process.removeListener('SIGTERM', forward)
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(new Error(signal
        ? `[edge-gist] Command terminated by ${signal}: ${command} ${args.join(' ')}`
        : `[edge-gist] Command failed with exit code ${code}: ${command} ${args.join(' ')}`))
    })

    child.on('error', reject)
  })
}
