declare const __ADMIN_ASSET_VERSION__: string

import type { Context } from 'hono'
import type { AppEnv } from './http/auth'

const iconBase = '/icons'

export function renderPwaManifest(c: Context<AppEnv>) {
  const config = c.get('config')
  const ownerPath = `/${encodeURIComponent(config.ownerUsername)}`

  return {
    id: ownerPath,
    name: 'EdgeGist',
    short_name: 'EdgeGist',
    description: 'A lightweight GitHub Gist-compatible service running on Cloudflare.',
    start_url: ownerPath,
    scope: `${ownerPath}/`,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    background_color: '#101514',
    theme_color: '#101514',
    categories: ['developer', 'productivity', 'utilities'],
    icons: [
      {
        src: `${iconBase}/edgegist.svg`,
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: `${iconBase}/edgegist-dark.svg`,
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: `${iconBase}/edgegist-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${iconBase}/edgegist-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${iconBase}/edgegist-dark-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${iconBase}/edgegist-dark-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${iconBase}/edgegist-maskable-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${iconBase}/edgegist-maskable-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${iconBase}/edgegist-dark-maskable-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${iconBase}/edgegist-dark-maskable-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}

export function renderServiceWorker(): string {
  const cacheName = `edgegist-static-${assetVersion()}`
  const iconUrls = [
    `${iconBase}/edgegist.svg`,
    `${iconBase}/edgegist-192.png`,
    `${iconBase}/edgegist-512.png`,
    `${iconBase}/edgegist-dark.svg`,
    `${iconBase}/edgegist-dark-192.png`,
    `${iconBase}/edgegist-dark-512.png`,
    `${iconBase}/edgegist-maskable-192.png`,
    `${iconBase}/edgegist-maskable-512.png`,
    `${iconBase}/edgegist-dark-maskable-192.png`,
    `${iconBase}/edgegist-dark-maskable-512.png`,
    `${iconBase}/apple-touch-icon.png`,
    `${iconBase}/apple-touch-icon-dark.png`,
  ]

  return `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(iconUrls)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('edgegist-static-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/static/') && !url.pathname.startsWith('/icons/')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
`
}

function assetVersion(): string {
  return typeof __ADMIN_ASSET_VERSION__ === 'string' ? __ADMIN_ASSET_VERSION__ : 'dev'
}
