import type { EdgeGistConfig } from '../env'
import { badRequest, notFound } from '../http/errors'
import { changeStatusForFileChanges, fileChangesForFiles, type FileRenameHint } from './file-changes'
import { applyRetention } from './retention'
import type {
  CreateGistRequest,
  GistFileRecord,
  GistRecord,
  GistRepository,
  GistVisibility,
  UpdateGistInput,
  UpdateGistRequest,
} from './types'

type ParsedFileUpdate = NonNullable<UpdateGistInput['files']>[number]

export class GistService {
  constructor(
    private readonly repository: GistRepository,
    private readonly config: EdgeGistConfig,
  ) {}

  async createFromRequest(payload: CreateGistRequest): Promise<GistRecord> {
    const now = new Date().toISOString()
    const files = parseCreateFiles(payload.files)
    if (files.length === 0) throw badRequest('Validation Failed: files is required')

    const gist = await this.repository.createGist({
      ownerLogin: this.config.ownerUsername,
      description: typeof payload.description === 'string' ? payload.description : '',
      visibility: parseVisibility(payload, 'secret'),
      files,
      now,
    })

    const changes = fileChangesForFiles([], gist.files)
    await this.repository.createVersion(gist, changeStatusForFileChanges(changes), changes)
    await applyRetention(this.repository, gist.id, this.config.retention)

    return gist
  }

  async updateFromRequest(id: string, payload: UpdateGistRequest): Promise<GistRecord | null> {
    const existing = await this.repository.getGist(id)
    if (!existing) throw notFound()

    const now = new Date().toISOString()
    const fileUpdates = parseUpdateFiles(payload.files)
    validateUpdateFilePlan(existing.files, fileUpdates)
    const updated = await this.repository.updateGist(id, {
      description: typeof payload.description === 'string' ? payload.description : undefined,
      visibility: hasVisibility(payload) ? parseVisibility(payload, existing.visibility) : undefined,
      files: fileUpdates,
      now,
    })

    if (!updated) throw notFound()
    if (updated.files.length === 0) {
      await this.repository.deleteGist(id)
      return null
    }

    const changes = fileChangesForFiles(existing.files, updated.files, renameHintsForUpdates(fileUpdates))
    await this.repository.createVersion(updated, changeStatusForFileChanges(changes), changes)
    await applyRetention(this.repository, updated.id, this.config.retention)

    return updated
  }
}

export function canReadGist(gist: GistRecord, isOwner: boolean): boolean {
  if (isOwner) return true
  return gist.visibility === 'public' || gist.visibility === 'secret'
}

function parseCreateFiles(files: unknown): Array<{ filename: string; content: string }> {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return []
  const parsed = Object.entries(files)
    .filter((entry): entry is [string, Record<string, unknown>] => {
      const [, value] = entry
      return value !== null && typeof value === 'object' && !Array.isArray(value)
    })
    .map(([filename, spec]) => ({
      filename,
      content: typeof spec.content === 'string' ? spec.content : '',
    }))
  if (parsed.some((file) => isBlankFilename(file.filename))) {
    throw badRequest('Validation Failed: filename is required')
  }
  if (parsed.some((file) => isBlankContent(file.content))) {
    throw badRequest('Validation Failed: file content is required')
  }
  return parsed
}

function parseUpdateFiles(files: unknown): ParsedFileUpdate[] {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return []

  return Object.entries(files).map(([previousFilename, value]) => {
    if (value === null) {
      return {
        previousFilename,
        filename: previousFilename,
        delete: true,
      }
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      throw badRequest('Validation Failed: file update must be an object or null')
    }

    const spec = value as Record<string, unknown>
    const hasContent = Object.prototype.hasOwnProperty.call(spec, 'content')
    const hasFilename = Object.prototype.hasOwnProperty.call(spec, 'filename')
    const content = typeof spec.content === 'string' ? spec.content : undefined
    const filename = typeof spec.filename === 'string' ? spec.filename : previousFilename
    return {
      previousFilename,
      filename,
      content,
      delete: spec.content === null || content === '' || (!hasContent && !hasFilename),
    }
  })
}

function renameHintsForUpdates(updates: ParsedFileUpdate[]): FileRenameHint[] {
  return updates
    .filter((update) => !update.delete && update.previousFilename !== update.filename)
    .map((update) => ({
      previousFilename: update.previousFilename,
      filename: update.filename,
    }))
}

function validateUpdateFilePlan(currentFiles: GistFileRecord[], updates: ParsedFileUpdate[]): void {
  const currentFilenames = new Set(currentFiles.map((file) => file.filename))
  const finalFilenames = new Set(currentFilenames)

  for (const update of updates) {
    if (isBlankFilename(update.previousFilename) || isBlankFilename(update.filename)) {
      throw badRequest('Validation Failed: filename is required')
    }

    if (update.delete) {
      finalFilenames.delete(update.previousFilename)
      continue
    }

    const updatesExistingFile = currentFilenames.has(update.previousFilename)
    if (!updatesExistingFile && update.content === undefined) continue

    if (updatesExistingFile && update.filename !== update.previousFilename) {
      finalFilenames.delete(update.previousFilename)
    }
  }

  for (const update of updates) {
    if (update.delete) continue

    const updatesExistingFile = currentFilenames.has(update.previousFilename)
    if (!updatesExistingFile && update.content === undefined) continue
    if (updatesExistingFile && update.filename === update.previousFilename) continue

    if (finalFilenames.has(update.filename)) {
      throw badRequest('Validation Failed: filenames must be unique')
    }
    finalFilenames.add(update.filename)
  }
}

function isBlankFilename(value: string): boolean {
  return value.length === 0
}

function isBlankContent(value: string): boolean {
  return value.length === 0
}

function parseVisibility(payload: CreateGistRequest | UpdateGistRequest, fallback: GistVisibility) {
  if (payload.visibility === 'public' || payload.visibility === 'secret') {
    return payload.visibility
  }
  if (payload.public === true) return 'public'
  if (payload.public === false) return 'secret'
  return fallback
}

function hasVisibility(payload: UpdateGistRequest): boolean {
  return (
    payload.visibility === 'public' ||
    payload.visibility === 'secret' ||
    typeof payload.public === 'boolean'
  )
}
