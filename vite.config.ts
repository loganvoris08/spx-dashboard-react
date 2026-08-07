import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API = 'https://spx-dashboard.up.railway.app'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/data':    { target: API, changeOrigin: true },
      '/api':     { target: API, changeOrigin: true },
      '/price':   { target: API, changeOrigin: true },
      '/macro':   { target: API, changeOrigin: true },
      '/candles': { target: API, changeOrigin: true },
    },
  },
})
