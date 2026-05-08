import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, join, relative } from 'node:path'
import { zipSync } from 'fflate'
import { verifyReleaseDirectory } from './verify-release'

const releaseRoot = 'release/edgegist'
const packageZipPath = 'release/edgegist-package.zip'
const uploadZipPath = 'release/edgegist-upload.zip'

rmSync(releaseRoot, { recursive: true, force: true })
rmSync(packageZipPath, { force: true })
rmSync(uploadZipPath, { force: true })
rmSync('release/edgegist.zip', { force: true })
mkdirSync(releaseRoot, { recursive: true })

copyDirectory('dist', join(releaseRoot, 'dist'))
copyDirectory('migrations', join(releaseRoot, 'migrations'))
copyDirectory('docs', join(releaseRoot, 'docs'))

for (const file of [
  'README.md',
  'README.zh-CN.md',
  'LICENSE',
  'package.json',
  'wrangler.example.jsonc',
]) {
  if (existsSync(file)) copyFileSync(file, join(releaseRoot, basename(file)))
}

writeFileSync(packageZipPath, zipSync(collectFilesForZip(releaseRoot, 'edgegist')))
writeFileSync(uploadZipPath, zipSync(collectFilesForZip('dist')))

const verification = verifyReleaseDirectory(releaseRoot, {
  requirePackageZip: true,
  packageZipPath,
  requireUploadZip: true,
  uploadZipPath,
})
if (!verification.ok) {
  console.error(`Release package missing required files:\n${verification.missing.join('\n')}`)
  process.exit(1)
}

console.log(`Release package created at ${releaseRoot}, ${packageZipPath}, and ${uploadZipPath}`)

function copyDirectory(from: string, to: string): void {
  if (!existsSync(from)) return
  cpSync(from, to, { recursive: true })
}

function collectFilesForZip(root: string, prefix = ''): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  visit(root)
  return files

  function visit(path: string): void {
    const stat = statSync(path)
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) visit(join(path, entry))
      return
    }

    const zipName = join(prefix, relative(root, path)).replaceAll('\\', '/')
    files[zipName] = new Uint8Array(readFileSync(path))
  }
}
