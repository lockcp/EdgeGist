import { mkdirSync, writeFileSync } from 'node:fs'
import { ConventionalChangelog } from 'conventional-changelog'

mkdirSync('release', { recursive: true })

const generator = new ConventionalChangelog()
  .readPackage()
  .loadPreset('angular')
  .options({ releaseCount: 1 })

let notes = ''
for await (const chunk of generator.write()) {
  notes += chunk.toString()
}

writeFileSync(
  'release/RELEASE_NOTES.md',
  notes.trim() ? notes : 'No conventional changelog entries found for this release.\n',
)
