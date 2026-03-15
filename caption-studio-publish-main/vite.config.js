import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
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
      }
    }
  }
});