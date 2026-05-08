import pages from '@hono/vite-cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig, type PluginOption } from 'vite'

export default defineConfig(async ({ command, mode }) => {
  const adminAssetVersion = Date.now().toString(36)

  if (mode === 'client') {
    return {
      define: {
        __ADMIN_ASSET_VERSION__: JSON.stringify(adminAssetVersion),
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: [
          { find: /^shiki$/, replacement: resolve(__dirname, './src/app/shiki-client-bundle.ts') },
          { find: '@', replacement: resolve(__dirname, './src') },
        ],
      },
      build: {
        chunkSizeWarningLimit: 700,
        emptyOutDir: true,
        copyPublicDir: false,
        rollupOptions: {
          input: './src/app/main.tsx',
          output: {
            dir: './dist',
            entryFileNames: 'static/app.js',
            chunkFileNames: 'static/assets/[name]-[hash].js',
            assetFileNames: (assetInfo: { names?: readonly string[]; name?: string }) => {
              const name = assetInfo.names?.[0] ?? assetInfo.name ?? ''
              return name.endsWith('.css') ? 'static/app.css' : 'static/assets/[name]-[hash][extname]'
            },
            manualChunks(id: string) {
              if (!id.includes('/node_modules/')) return undefined
              if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
                return 'vendor-react'
              }
              if (id.includes('/node_modules/lucide-react/')) return 'vendor-icons'
              if (id.includes('/node_modules/@pierre/diffs/')) return 'vendor-diffs'
              if (id.includes('/node_modules/@pierre/trees/')) return 'vendor-trees'
              if (id.includes('/node_modules/@pierre/theme/')) return 'vendor-pierre-theme'
              if (id.includes('/node_modules/diff/')) return 'vendor-diff'
              if (
                (id.includes('/node_modules/shiki/') || id.includes('/node_modules/@shikijs/')) &&
                !id.includes('/node_modules/@shikijs/langs/') &&
                !id.includes('/node_modules/@shikijs/themes/')
              ) {
                return 'vendor-shiki'
              }
              return undefined
            },
          },
        },
      },
    }
  }

  const plugins: PluginOption[] = [
    tailwindcss(),
    pages({
      entry: 'src/index.ts',
    }),
  ]

  if (command === 'serve') {
    const { default: cloudflareAdapter } = await import('@hono/vite-dev-server/cloudflare')
    plugins.push(devServer({
      entry: 'src/index.ts',
      adapter: cloudflareAdapter({
        proxy: {
          envFiles: ['.dev.vars'],
          remoteBindings: false,
        },
      }),
      ignoreWatching: [/\.wrangler/],
    }))
  }

  return {
    define: {
      __ADMIN_ASSET_VERSION__: JSON.stringify(adminAssetVersion),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    plugins,
  }
})
