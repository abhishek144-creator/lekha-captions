import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@radix-ui') || id.includes('lucide-react')) return 'vendor-ui'
          if (id.includes('@tanstack/react-query')) return 'vendor-query'
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('firebase')) return 'vendor-firebase'
          return 'vendor-misc'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    port: 5000,
    allowedHosts: ['localhost', '127.0.0.1'],
    proxy: {
      // 1. Send API requests to Python
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // 2. Send Video requests to Python (FIXES BLACK SCREEN)
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // 3. Send Export requests to Python
      '/exports': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    }
  }
})
