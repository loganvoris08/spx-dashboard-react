import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API = 'https://spx-dashboard.up.railway.app'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
