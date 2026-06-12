import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 開發時把 API / WebSocket 代理到 FastAPI（預設 8600）
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8610', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8610', ws: true },
    },
  },
  build: { outDir: 'dist' },
})
