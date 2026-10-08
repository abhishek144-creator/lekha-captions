import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Unit tests for editor logic and hooks. Kept separate from vite.config.js,
// whose dev plugins start the backend and add dev-server middleware.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
    setupFiles: ['src/test/setup.js'],
  },
})
