import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { spawn } from 'node:child_process'
import http from 'node:http'

const backendTarget = process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000'
const backendUrl = new URL(backendTarget)
const backendPort = Number(backendUrl.port || 8000)
const backendHost = backendUrl.hostname === 'localhost' ? '127.0.0.1' : backendUrl.hostname
const backendAutostartDisabled = process.env.LEKHA_DISABLE_BACKEND_AUTOSTART === '1'

function isLocalBackendTarget() {
  return ['localhost', '127.0.0.1'].includes(backendUrl.hostname)
}

function requestReady(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 500)
    })
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

function backendAutostartPlugin() {
  let backendProcess = null
  let monitor = null
  let starting = false

  async function ensureBackendRunning() {
    if (backendAutostartDisabled || !isLocalBackendTarget() || starting) return
    if (await requestReady(`${backendTarget}/api/version`)) return
    if (backendProcess && !backendProcess.killed) return

    starting = true
    const pythonCommand = process.env.PYTHON || 'python'
    console.log(`[lekha] Backend API is not reachable; starting ${backendTarget}`)
    backendProcess = spawn(pythonCommand, [
      '-m',
      'uvicorn',
      'backend.main:app',
      '--host',
      backendHost,
      '--port',
      String(backendPort),
      '--reload',
    ], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    })
    backendProcess.on('exit', (code, signal) => {
      backendProcess = null
      if (code || signal) {
        console.warn(`[lekha] Backend stopped (${signal || code}). It will be restarted if the dev server stays open.`)
      }
    })
    backendProcess.on('error', (error) => {
      backendProcess = null
      console.warn(`[lekha] Could not start backend: ${error?.message || error}`)
    })
    starting = false
  }

  function cleanup() {
    if (monitor) clearInterval(monitor)
    monitor = null
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill()
    }
    backendProcess = null
  }

  return {
    name: 'lekha-backend-autostart',
    apply: 'serve',
    configureServer(server) {
      const startMonitor = () => {
        ensureBackendRunning()
        monitor = setInterval(ensureBackendRunning, 7000)
      }
      if (server.httpServer?.listening) startMonitor()
      else server.httpServer?.once('listening', startMonitor)
      server.httpServer?.once('close', cleanup)
    },
  }
}

export default defineConfig({
  plugins: [backendAutostartPlugin(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('@radix-ui') || id.includes('lucide-react')) return 'vendor-ui'
          if (id.includes('@tanstack/react-query')) return 'vendor-query'
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('react') || id.includes('scheduler') || id.includes('prop-types')) return 'vendor-react'
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
    port: 3000,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1'],
    proxy: {
      // 1. Send API requests to Python
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    }
  }
})
