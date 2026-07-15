import { spawn } from 'node:child_process'

const python = process.env.PYTHON || 'python'
const child = spawn(python, [
  '-m', 'uvicorn', 'backend.main:app',
  '--host', '127.0.0.1', '--port', '8000', '--reload',
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    APP_ENV: process.env.APP_ENV || 'development',
    LOCAL_DEV_AUTH_BYPASS: process.env.LOCAL_DEV_AUTH_BYPASS || '1',
  },
  stdio: 'inherit',
  windowsHide: true,
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
