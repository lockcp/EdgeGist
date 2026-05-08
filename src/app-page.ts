declare const __ADMIN_ASSET_VERSION__: string

export type AppPageConfig = {
  turnstileSiteKey: string | null
}

export function renderAppPage(pathname = '/', config: AppPageConfig = { turnstileSiteKey: null }): string {
  const ownerPath = ownerPathFromPagePath(pathname)
  const pwaLinks = ownerPath
    ? `<link rel="manifest" href="${ownerPath}/manifest.webmanifest" />
    <link rel="icon" href="/icons/edgegist.svg" type="image/svg+xml" />
    <link rel="icon" href="/icons/edgegist-dark.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-dark.png" media="(prefers-color-scheme: dark)" />`
    : ''
  const script = import.meta.env.PROD
    ? `/static/app.js?v=${__ADMIN_ASSET_VERSION__}`
    : '/src/app/main.tsx'
  const stylesheet = import.meta.env.PROD
    ? `<link rel="stylesheet" href="/static/app.css?v=${__ADMIN_ASSET_VERSION__}" />`
    : ''
  const bootMarkup = renderAdminBootMarkup(pathname)
  const bootStyle = `<style>
      :root {
        --eg-boot-bg: hsl(215 20% 98%);
        --eg-boot-card: hsl(215 16% 100%);
        --eg-boot-sidebar: hsl(215 16% 97%);
        --eg-boot-border: hsl(215 10% 84%);
        --eg-boot-muted: hsl(215 12% 92%);
        --eg-boot-muted-strong: hsl(215 10% 84%);
        --eg-boot-primary: hsl(214 16% 34%);
      }
      html[data-admin-mode="dark"] {
        --eg-boot-bg: hsl(215 14% 8%);
        --eg-boot-card: hsl(215 12% 11%);
        --eg-boot-sidebar: hsl(215 12% 10%);
        --eg-boot-border: hsl(215 8% 22%);
        --eg-boot-muted: hsl(215 10% 15%);
        --eg-boot-muted-strong: hsl(215 8% 22%);
        --eg-boot-primary: hsl(214 16% 72%);
      }
      html,
      body {
        margin: 0;
        background: var(--eg-boot-bg);
      }
      .eg-boot {
        min-height: 100vh;
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: grid;
        grid-template-columns: 256px minmax(0, 1fr);
        overflow: hidden;
        background: var(--eg-boot-bg);
        color: transparent;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .eg-boot-sidebar {
        border-right: 1px solid var(--eg-boot-border);
        background: var(--eg-boot-sidebar);
        padding: 16px;
      }
      .eg-boot-brand,
      .eg-boot-nav {
        border-radius: 8px;
        background: var(--eg-boot-muted);
      }
      .eg-boot-brand {
        height: 48px;
        margin-bottom: 32px;
      }
      .eg-boot-nav {
        height: 40px;
        margin-top: 12px;
      }
      .eg-boot-page {
        min-width: 0;
      }
      .eg-boot-header {
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 1px solid var(--eg-boot-border);
        padding: 0 24px;
        background: color-mix(in srgb, var(--eg-boot-bg) 95%, transparent);
      }
      .eg-boot-heading {
        min-width: 0;
        flex: 1;
      }
      .eg-boot-line,
      .eg-boot-control,
      .eg-boot-card {
        overflow: hidden;
        position: relative;
      }
      .eg-boot-line,
      .eg-boot-control,
      .eg-boot-brand,
      .eg-boot-nav,
      .eg-boot-card-surface {
        animation: eg-boot-pulse 1.4s ease-in-out infinite;
      }
      .eg-boot-line {
        height: 12px;
        border-radius: 999px;
        background: var(--eg-boot-muted);
      }
      .eg-boot-line[data-size="title"] {
        height: 20px;
        width: 220px;
        margin-top: 8px;
      }
      .eg-boot-line[data-size="eyebrow"] {
        width: 96px;
      }
      .eg-boot-actions {
        display: flex;
        gap: 8px;
      }
      .eg-boot-control {
        width: 88px;
        height: 36px;
        border-radius: 8px;
        background: var(--eg-boot-muted);
      }
      .eg-boot-control[data-icon="true"] {
        width: 40px;
      }
      .eg-boot-main {
        max-width: 1760px;
        margin: 0 auto;
        padding: 24px;
      }
      .eg-boot-back {
        width: 128px;
        height: 36px;
        border-radius: 8px;
        background: var(--eg-boot-muted);
        margin-bottom: 16px;
        animation: eg-boot-pulse 1.4s ease-in-out infinite;
      }
      .eg-boot-card {
        border: 1px solid var(--eg-boot-border);
        border-radius: 8px;
        background: var(--eg-boot-card);
        padding: 16px;
      }
      .eg-boot-detail {
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr) 240px;
        gap: 16px;
        margin-top: 16px;
      }
      .eg-boot-card-surface {
        border-radius: 6px;
        background: var(--eg-boot-muted);
      }
      .eg-boot-tree {
        height: 280px;
      }
      .eg-boot-content {
        height: 360px;
      }
      .eg-boot-history {
        height: 160px;
      }
      .eg-boot-card .eg-boot-line + .eg-boot-line {
        margin-top: 12px;
      }
      @keyframes eg-boot-pulse {
        0%, 100% { opacity: 0.58; }
        50% { opacity: 1; }
      }
      @media (max-width: 1279px) {
        .eg-boot-detail {
          grid-template-columns: 1fr;
        }
        .eg-boot-tree,
        .eg-boot-content,
        .eg-boot-history {
          height: 140px;
        }
      }
      @media (max-width: 767px) {
        .eg-boot {
          display: block;
        }
        .eg-boot-sidebar {
          display: none;
        }
        .eg-boot-header {
          padding: 0 16px;
        }
        .eg-boot-control:not([data-icon="true"]) {
          display: none;
        }
        .eg-boot-main {
          padding: 16px;
        }
      }
    </style>`
  const themeScript = `<script>
      (() => {
        try {
          const root = document.documentElement;
          const storedMode = localStorage.getItem('edgegist.admin.colorMode');
          const mode = storedMode === 'light' || storedMode === 'dark' || storedMode === 'system' ? storedMode : 'system';
          const resolvedMode = mode === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : mode;
          const storedTheme = localStorage.getItem('edgegist.admin.themePalette');
          const themes = ['neutral', 'zinc', 'slate', 'stone', 'gray', 'mauve', 'olive', 'mist', 'taupe', 'sage'];
          root.dataset.adminMode = resolvedMode;
          root.dataset.adminTheme = themes.includes(storedTheme) ? storedTheme : 'slate';
          root.style.colorScheme = resolvedMode;
        } catch {
          document.documentElement.dataset.adminMode = 'light';
          document.documentElement.dataset.adminTheme = 'slate';
        }
      })();
    </script>`
  const publicConfigScript = `<script>
      window.__EDGEGIST_PUBLIC_CONFIG__ = ${JSON.stringify(config).replace(/</g, '\\u003c')};
    </script>`
  const serviceWorkerScript = ownerPath
    ? `<script>
      (() => {
        if (!('serviceWorker' in navigator)) return;
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('${ownerPath}/edgegist-sw', { scope: '${ownerPath}/' }).catch(() => {});
        });
      })();
    </script>`
    : ''
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <meta name="theme-color" content="#101514" />
    <meta name="application-name" content="EdgeGist" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="EdgeGist" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta http-equiv="Cache-Control" content="no-store" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>EdgeGist</title>
    ${pwaLinks}
    ${themeScript}
    ${publicConfigScript}
    ${bootStyle}
    ${stylesheet}
    <script type="module" src="${script}"></script>
    ${serviceWorkerScript}
  </head>
  <body>
    ${bootMarkup}
    <div id="root"></div>
  </body>
</html>`
}

function ownerPathFromPagePath(pathname: string): string | null {
  const path = pathname.split(/[?#]/, 1)[0] ?? ''
  const owner = path.split('/').filter(Boolean)[0]
  if (!owner) return null
  try {
    return `/${encodeURIComponent(decodeURIComponent(owner))}`
  } catch {
    return `/${encodeURIComponent(owner)}`
  }
}

function renderAdminBootMarkup(pathname: string): string {
  const [, , routeSegment = ''] = pathname.split(/[/?#]/)[0]?.split('/') ?? []
  const isDetail = Boolean(
    routeSegment &&
      routeSegment !== 'new' &&
      routeSegment !== 'cloudflare' &&
      routeSegment !== 'data' &&
      !routeSegment.startsWith('_'),
  )

  return `<div class="eg-boot" data-edgegist-boot-shell aria-busy="true" aria-label="Loading EdgeGist">
      <aside class="eg-boot-sidebar" aria-hidden="true">
        <div class="eg-boot-brand"></div>
        <div class="eg-boot-nav"></div>
        <div class="eg-boot-nav"></div>
        <div class="eg-boot-nav"></div>
      </aside>
      <div class="eg-boot-page">
        <header class="eg-boot-header" aria-hidden="true">
          <div class="eg-boot-heading">
            <div class="eg-boot-line" data-size="eyebrow"></div>
            <div class="eg-boot-line" data-size="title"></div>
          </div>
          <div class="eg-boot-actions">
            <div class="eg-boot-control" data-icon="true"></div>
            <div class="eg-boot-control"></div>
            <div class="eg-boot-control"></div>
            <div class="eg-boot-control" data-icon="true"></div>
          </div>
        </header>
        <main class="eg-boot-main" aria-hidden="true">
          ${isDetail ? '<div class="eg-boot-back"></div>' : ''}
          <section class="eg-boot-card">
            <div class="eg-boot-line" style="width: min(360px, 70%)"></div>
            <div class="eg-boot-line" style="width: min(520px, 85%)"></div>
          </section>
          ${
            isDetail
              ? `<section class="eg-boot-detail">
                  <div class="eg-boot-card eg-boot-card-surface eg-boot-tree"></div>
                  <div class="eg-boot-card eg-boot-card-surface eg-boot-content"></div>
                  <div class="eg-boot-card eg-boot-card-surface eg-boot-history"></div>
                </section>`
              : ''
          }
        </main>
      </div>
    </div>`
}
