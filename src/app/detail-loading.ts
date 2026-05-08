import type { GistDetail } from './types'

export function isSelectedGistDetailLoading({
  detail,
  detailLoading,
  hasClient,
  selectedGistId,
}: {
  detail: Pick<GistDetail, 'id'> | null
  detailLoading: boolean
  hasClient: boolean
  selectedGistId: string | null
}) {
  return Boolean(
    hasClient &&
      selectedGistId &&
      (detailLoading || !detail || detail.id !== selectedGistId),
  )
}

export function shouldHideAdminBootShell({
  contentHighlightLoading,
  contentSelectionLoading,
  detailLoading,
  hasClient,
  hasError,
  isGistsSection,
  selectedGistId,
}: {
  contentHighlightLoading: boolean
  contentSelectionLoading: boolean
  detailLoading: boolean
  hasClient: boolean
  hasError: boolean
  isGistsSection: boolean
  selectedGistId: string | null
}) {
  return (
    !hasClient ||
    hasError ||
    !isGistsSection ||
    !selectedGistId ||
    (!detailLoading && !contentSelectionLoading && !contentHighlightLoading)
  )
}
