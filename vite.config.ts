import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const API = 'https://spx-dashboard.up.railway.app'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SPX Command Center',
        short_name: 'SPX',
        description: 'Live SPX options & gamma dashboard',
        theme_color: '#020509',
        background_color: '#020509',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icons/pwa-64x64.png',   sizes: '64x64',   type: 'image/png' },
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache app shell and static assets; don't cache API calls
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache the main dashboard data for 5 minutes so app loads offline
            urlPattern: /\/data$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-data',
              expiration: { maxAgeSeconds: 300, maxEntries: 5 },
            },
          },
        ],
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: {
    proxy: {
      '/data':      { target: API, changeOrigin: true },
      '/api':       { target: API, changeOrigin: true },
      '/price':     { target: API, changeOrigin: true },
      '/macro':     { target: API, changeOrigin: true },
      '/candles':   { target: API, changeOrigin: true },
      '/es-candles':{ target: API, changeOrigin: true },
      '/es-zones':  { target: API, changeOrigin: true },
      '/nq-candles':{ target: API, changeOrigin: true },
      '/nq-zones':       { target: API, changeOrigin: true },
      '/spx-zones':      { target: API, changeOrigin: true },
      '/es-candles-10m': { target: API, changeOrigin: true },
      '/es-zones-10m':   { target: API, changeOrigin: true },
      '/nq-candles-10m': { target: API, changeOrigin: true },
      '/nq-zones-10m':   { target: API, changeOrigin: true },
      '/opex':           { target: API, changeOrigin: true },
      '/fomc':           { target: API, changeOrigin: true },
      '/earnings':       { target: API, changeOrigin: true },
      '/calendar':       { target: API, changeOrigin: true },
      '/institutions':   { target: API, changeOrigin: true },
    },
  },
})
