import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Ensure every module imports the same React instance.
    // Without this, motion/react can pick up a duplicate React copy from
    // Vite's pre-bundled deps and hooks throw "dispatcher is null".
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'motion', 'motion/react'],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      // Forward every /api/* and /actuator/* call to the Spring Boot backend.
      // This eliminates CORS entirely in dev — the browser sees every request
      // coming from localhost:5173 (same origin).
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        // SSE streams need the proxy to flush chunks immediately — don't buffer.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('connection', 'keep-alive')
          })
        },
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
