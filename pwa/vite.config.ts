import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5174,
    // The FastAPI backend (server/) runs on 4274 in development
    proxy: { '/api': { target: 'http://127.0.0.1:4274', xfwd: true, ws: true } }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'mxtape',
        short_name: 'mxtape',
        description: 'Song hören, Jahr raten, an die richtige Stelle der Zeitleiste legen.',
        // Mirrored from design-tokens.css: dark surface (neutral-6)
        theme_color: '#191113',
        background_color: '#191113',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/assets/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Never precache audio: /audio/ needs a signed-in session (nginx auth_request)
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        globIgnores: ['**/assets/**/*.png', 'audio/**'],
        cacheId: 'mxtape-v14',
        cleanupOutdatedCaches: true,
        // Navigation fallback - always serve index.html for SPA routes
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          // Don't use fallback for these patterns
          /^\/api\//,
          /^\/audio\//,
          // Room links must come from the network: an older cached shell does not
          // know these routes and would send a scanned invite to the start page
          /^\/r\//,
          /^\/room\//,
          /^\/raum\//, // old German room address, redirected by the app
          /^\/reset-password/, // link from the reset mail, same reason
          /^\/(about|landing|help)\/?$/, // product page: shared links must reach the current app
          /^\/tv\/?$/, // the TV's join page, same reason
          /\.[a-zA-Z0-9]+$/ // Files with extensions (except HTML)
        ],
        runtimeCaching: [
          {
            // Always fetch navigation requests from network first
            // /api/ navigations (OAuth redirects) always go straight to the network
            urlPattern: ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            // Cache PNG assets at runtime
            urlPattern: /\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types')
    }
  }
})
