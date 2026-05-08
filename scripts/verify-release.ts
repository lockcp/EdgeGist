import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync } from 'fflate'

export type ReleaseVerificationResult = {
  ok: boolean
  missing: string[]
}

const requiredFiles = [
  'dist/_worker.js',
  'migrations/0001_initial.sql',
  'README.md',
  'README.zh-CN.md',
  'wrangler.example.jsonc',
]

export function verifyReleaseDirectory(
  root = 'release/edgegist',
  options: {
    requirePackageZip?: boolean
    packageZipPath?: string
    requireUploadZip?: boolean
    uploadZipPath?: string
  } = {},
): ReleaseVerificationResult {
  const missing = requiredFiles.filter((file) => !existsSync(join(root, file)))
  if (options.requirePackageZip && !existsSync(options.packageZipPath ?? 'release/edgegist-package.zip')) {
    missing.push(options.packageZipPath ?? 'release/edgegist-package.zip')
  }
  if (options.requireUploadZip) {
    const uploadZip = options.uploadZipPath ?? 'release/edgegist-upload.zip'
    if (!existsSync(uploadZip)) {
      missing.push(uploadZip)
    } else if (!uploadZipContainsWorker(uploadZip)) {
      missing.push(`${uploadZip}:_worker.js`)
    }
  }
  return {
    ok: missing.length === 0,
    missing,
  }
}

if (import.meta.main) {
  const root = process.argv[2] ?? 'release/edgegist'
  const result = verifyReleaseDirectory(root, {
    requirePackageZip: true,
    requireUploadZip: true,
  })
  if (!result.ok) {
    console.error(`Release artifact is missing required files:\n${result.missing.join('\n')}`)
    process.exit(1)
  }
  console.log(`Release artifact verified: ${root}`)
}

function uploadZipContainsWorker(path: string): boolean {
  const entries = unzipSync(new Uint8Array(readFileSync(path)))
  return Object.hasOwn(entries, '_worker.js')
}
