import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['ev.svg', 'pwa-maskable.svg'],
      manifest: {
        name: 'EVPath — EV Trip Planner India',
        short_name: 'EVPath',
        description: 'Plan EV trips across India with real-time charging station data and GPS navigation.',
        theme_color: '#00E094',
        background_color: '#050B15',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'ev.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Cache all build output (JS, CSS, HTML, fonts, icons)
        globPatterns: ['**/*.{js,css,html,svg,ico,woff,woff2}'],
        // Runtime caching strategies
        runtimeCaching: [
          // Google Fonts — cache-first, long TTL
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          // OpenStreetMap tiles — cache-first, 7-day TTL
          // Cached tiles render the map even offline for recently viewed areas
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          // Leaflet CSS from unpkg — cache-first
          {
            urlPattern: /^https:\/\/unpkg\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unpkg-assets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // EVPath backend API — network-first, fall back to cache
          // Allows offline viewing of a recently planned route
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'evpath-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
