import { describe, expect, it } from 'bun:test'
import { isSelectedGistDetailLoading, shouldHideAdminBootShell } from '../../src/app/detail-loading'

describe('app detail loading gate', () => {
  it('stays loading while the selected detail request is still finishing', () => {
    expect(
      isSelectedGistDetailLoading({
        detail: { id: 'gist-1' },
        detailLoading: true,
        hasClient: true,
        selectedGistId: 'gist-1',
      }),
    ).toBe(true)
  })

  it('stops loading only after the selected detail request has fully settled', () => {
    expect(
      isSelectedGistDetailLoading({
        detail: { id: 'gist-1' },
        detailLoading: false,
        hasClient: true,
        selectedGistId: 'gist-1',
      }),
    ).toBe(false)
  })

  it('treats missing or stale detail data as loading', () => {
    expect(
      isSelectedGistDetailLoading({
        detail: null,
        detailLoading: false,
        hasClient: true,
        selectedGistId: 'gist-1',
      }),
    ).toBe(true)

    expect(
      isSelectedGistDetailLoading({
        detail: { id: 'gist-2' },
        detailLoading: false,
        hasClient: true,
        selectedGistId: 'gist-1',
      }),
    ).toBe(true)
  })

  it('does not block the boot shell before authentication is available', () => {
    expect(
      isSelectedGistDetailLoading({
        detail: null,
        detailLoading: false,
        hasClient: false,
        selectedGistId: 'gist-1',
      }),
    ).toBe(false)
  })
})

describe('app boot shell gate', () => {
  const readyState = {
    contentHighlightLoading: false,
    contentSelectionLoading: false,
    detailLoading: false,
    hasClient: true,
    hasError: false,
    isGistsSection: true,
    selectedGistId: 'gist-1',
  }

  it('keeps the server boot shell visible until the detail content is render-ready', () => {
    expect(
      shouldHideAdminBootShell({
        ...readyState,
        detailLoading: true,
      }),
    ).toBe(false)

    expect(
      shouldHideAdminBootShell({
        ...readyState,
        contentSelectionLoading: true,
      }),
    ).toBe(false)

    expect(
      shouldHideAdminBootShell({
        ...readyState,
        contentHighlightLoading: true,
      }),
    ).toBe(false)
  })

  it('hides the server boot shell once the selected detail content is ready', () => {
    expect(shouldHideAdminBootShell(readyState)).toBe(true)
  })

  it('does not keep the server boot shell over non-detail or unauthenticated states', () => {
    expect(
      shouldHideAdminBootShell({
        ...readyState,
        hasClient: false,
      }),
    ).toBe(true)

    expect(
      shouldHideAdminBootShell({
        ...readyState,
        selectedGistId: null,
      }),
    ).toBe(true)

    expect(
      shouldHideAdminBootShell({
        ...readyState,
        isGistsSection: false,
      }),
    ).toBe(true)
  })
})
