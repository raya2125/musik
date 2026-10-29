import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      }
    }
  }
})
