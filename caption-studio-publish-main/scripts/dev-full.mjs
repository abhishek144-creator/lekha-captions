import { spawn } from "node:child_process";
import http from "node:http";
import https from "node:https";
import process from "node:process";

const root = process.cwd();
const backendPort = Number(process.env.LEKHA_BACKEND_PORT || 8000);
const frontendPort = Number(process.env.LEKHA_FRONTEND_PORT || 3000);
const backendUrl = process.env.VITE_BACKEND_PROXY_TARGET || `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://localhost:${frontendPort}`;
const frontendApiUrl = `${frontendUrl}/api/version`;
const npmCommand = process.platform === "win32" ? "cmd.exe" : "npm";
const npmArgsPrefix = process.platform === "win32" ? ["/c", "npm"] : [];
const backendEnv = {
  ...process.env,
  APP_ENV: process.env.APP_ENV || "development",
  LOCAL_DEV_AUTH_BYPASS: process.env.LOCAL_DEV_AUTH_BYPASS || "1",
};
const frontendEnv = {
  ...process.env,
  VITE_BACKEND_PROXY_TARGET: backendUrl,
  VITE_USE_DEV_AUTH_BYPASS: process.env.VITE_USE_DEV_AUTH_BYPASS || "1",
};

const children = new Set();
let shuttingDown = false;

function requestReady(url, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.get(parsed, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function waitFor(url, seconds, label) {
  for (let i = 0; i < seconds; i += 1) {
    if (await requestReady(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.error(`${label} did not become ready at ${url}`);
  return false;
}

function startProcess(label, command, args, options = {}) {
  console.log(`[dev] Starting ${label}: ${command} ${args.join(" ")}`);
  let child;
  try {
    child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
      ...options,
    });
  } catch (error) {
    console.error(`[dev] Failed to start ${label}: ${error?.message || error}`);
    shutdown(1);
    throw error;
  }
  children.add(child);
  child.on("error", (error) => {
    console.error(`[dev] Failed to start ${label}: ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`[dev] ${label} stopped (${signal || (code ?? 0)}).`);
      shutdown(code || 1);
    }
  });
  return child;
}

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // best effort
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("===================================================");
console.log("  Lekha Captions full dev server");
console.log("===================================================");
console.log(`[dev] Backend:  ${backendUrl}`);
console.log(`[dev] Frontend: ${frontendUrl}`);

if (!(await requestReady(`${backendUrl}/api/version`))) {
  startProcess("backend", process.env.PYTHON || "python", [
    "-m",
    "uvicorn",
    "backend.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(backendPort),
  ], { env: backendEnv });

  if (!(await waitFor(`${backendUrl}/api/version`, 90, "Backend"))) {
    shutdown(1);
  }
} else {
  console.log("[dev] Backend already ready.");
}

if (!(await requestReady(frontendUrl))) {
  startProcess("frontend", npmCommand, [
    ...npmArgsPrefix,
    "run",
    "dev:frontend",
    "--",
    "--host",
    "localhost",
    "--port",
    String(frontendPort),
  ], {
    env: frontendEnv,
  });

  if (!(await waitFor(frontendUrl, 60, "Frontend"))) {
    shutdown(1);
  }
} else {
  console.log("[dev] Frontend already ready.");
}

if (!(await waitFor(frontendApiUrl, 20, "Frontend API proxy"))) {
  console.warn(`[dev] ${frontendUrl} is running, but /api is not reaching ${backendUrl}.`);
  console.error(`[dev] Check the existing service on port ${frontendPort} and its API proxy, then run npm run dev again.`);
  shutdown(1);
}

console.log("");
console.log("[dev] All systems ready.");
console.log(`[dev] Open ${frontendUrl}/Dashboard`);
process.stdin.resume();
