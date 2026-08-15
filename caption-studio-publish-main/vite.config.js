import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execFileSync, spawn } from 'node:child_process'
import http from 'node:http'

const backendTarget = process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000'
const backendUrl = new URL(backendTarget)
const backendPort = Number(backendUrl.port || 8000)
const backendHost = backendUrl.hostname === 'localhost' ? '127.0.0.1' : backendUrl.hostname
const backendAutostartDisabled = process.env.LEKHA_DISABLE_BACKEND_AUTOSTART === '1'
const backendEnv = {
  ...process.env,
  APP_ENV: process.env.APP_ENV || 'development',
  LOCAL_DEV_AUTH_BYPASS: process.env.LOCAL_DEV_AUTH_BYPASS || '1',
}
const baseSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
}
const productionCsp = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' https://checkout.razorpay.com; frame-src https://*.razorpay.com https://*.firebaseapp.com; connect-src 'self' https:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com"

function isLocalBackendTarget() {
  return ['localhost', '127.0.0.1'].includes(backendUrl.hostname)
}

function requestReady(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 300)
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

  function stopStaleWindowsBackend() {
    if (process.platform !== 'win32') return false
    const script = `
$connections = Get-NetTCPConnection -LocalPort ${backendPort} -State Listen -ErrorAction SilentlyContinue
$pids = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($ownerPid in $pids) {
  if (-not $ownerPid) { continue }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
  if (-not $proc) { continue }
  $name = [string]$proc.Name
  $command = [string]$proc.CommandLine
  $looksLikeBackend = ($command -match 'uvicorn') -and ($command -match 'backend\\.main:app')
  if (($name -match '^(node|npm|cmd|powershell|python)(\\.exe)?$') -and -not $looksLikeBackend) {
    Stop-Process -Id $proc.ProcessId -Force
    Write-Output "stopped:$($proc.ProcessId)"
  }
}
`
    try {
      const output = execFileSync("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ], { encoding: "utf8" })
      if (output.trim()) {
        console.log(`[lekha] Replaced stale backend on port ${backendPort}: ${output.trim()}`)
        return true
      }
    } catch (error) {
      console.warn(`[lekha] Could not stop stale backend: ${error?.message || error}`)
    }
    return false
  }

  async function ensureBackendRunning() {
    if (backendAutostartDisabled || !isLocalBackendTarget() || starting) return
    if (await requestReady(`${backendTarget}/api/version`)) return
    stopStaleWindowsBackend()
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
    ], {
      cwd: process.cwd(),
      env: backendEnv,
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

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  if (mode === 'production' && !env.VITE_API_BASE_URL && env.VITE_ALLOW_SAME_ORIGIN_API !== '1') {
    throw new Error(
      'Production builds require VITE_API_BASE_URL. Set VITE_ALLOW_SAME_ORIGIN_API=1 only when the host reverse-proxies /api to the backend.'
    )
  }

  return {
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
    headers: baseSecurityHeaders,
    proxy: {
      // 1. Send API requests to Python
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    }
  },
  preview: {
    headers: {
      ...baseSecurityHeaders,
      'Content-Security-Policy': productionCsp,
    },
  },
  }
})
