import { describe, expect, test } from 'bun:test'
import { renderAppPage } from '../../src/app-page'

describe('app page shell', () => {
  test('renders a boot skeleton outside the client root before the app loads', () => {
    const html = renderAppPage('/owner/example')

    expect(html).toContain('data-edgegist-boot-shell')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('eg-boot-detail')
    expect(html).toContain('<div id="root"></div>')
    expect(html.indexOf('data-edgegist-boot-shell')).toBeLessThan(html.indexOf('<div id="root"></div>'))
  })

  test('renders the detail boot skeleton for owner detail routes', () => {
    const html = renderAppPage('/owner/example')

    expect(html).toContain('data-edgegist-boot-shell')
    expect(html).toContain('eg-boot-detail')
  })

  test('adds owner-scoped PWA metadata and service worker registration', () => {
    const html = renderAppPage('/owner%20name/example')

    expect(html).toContain('<link rel="manifest" href="/owner%20name/manifest.webmanifest" />')
    expect(html).toContain('<link rel="icon" href="/icons/edgegist.svg" type="image/svg+xml" />')
    expect(html).toContain('<link rel="icon" href="/icons/edgegist-dark.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)" />')
    expect(html).toContain("navigator.serviceWorker.register('/owner%20name/edgegist-sw', { scope: '/owner%20name/' })")
  })

  test('does not render the detail boot skeleton for the new gist route', () => {
    const html = renderAppPage('/owner/new')

    expect(html).toContain('data-edgegist-boot-shell')
    expect(html).not.toContain('<section class="eg-boot-detail">')
  })
})
