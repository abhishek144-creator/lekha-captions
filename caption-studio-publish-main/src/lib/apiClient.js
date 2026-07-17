import { auth } from '@/lib/firebase'
import { shouldDispatchAuthLogout } from '@/lib/apiErrorPolicy'

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message || "Request failed")
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

const inFlightControllers = new Map()
const LOCAL_API_RETRY_MS = Math.max(
  0,
  Number(import.meta.env.VITE_LOCAL_API_RETRY_MS || (import.meta.env.DEV ? 12000 : 0)),
)
const LOCAL_API_RETRY_DELAY_MS = 450
const LOCAL_DIRECT_BACKEND_URL = String(
  import.meta.env.VITE_DIRECT_BACKEND_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : ""),
).replace(/\/+$/, "")
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")

function resolveApiUrl(url) {
  if (!API_BASE_URL || typeof url !== "string" || !url.startsWith("/api")) return url
  return `${API_BASE_URL}${url}`
}

function isLocalApiRequest(url) {
  if (typeof url !== "string") return false
  if (url.startsWith("/api")) return true
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.pathname.startsWith("/api")
      && ["localhost", "127.0.0.1"].includes(parsed.hostname)
  } catch {
    return false
  }
}

function getBackendUnavailableMessage() {
  if (!import.meta.env.DEV) {
    return "Service is temporarily unavailable. Please try again shortly."
  }
  return "Backend API is not reachable. Start the full app with start_app.bat or npm run dev so localhost:3000 and the Python backend on port 8000 are both running."
}

function getLocalDirectBackendUrl(url) {
  if (!LOCAL_DIRECT_BACKEND_URL || !isLocalApiRequest(url) || typeof window === "undefined") return ""
  try {
    const parsed = new URL(url, window.location.origin)
    if (!parsed.pathname.startsWith("/api")) return ""
    return `${LOCAL_DIRECT_BACKEND_URL}${parsed.pathname}${parsed.search}`
  } catch {
    return ""
  }
}

// FastAPI validation failures (422) put an ARRAY of {loc, msg, type} objects in
// `detail`; naive string coercion shows "[object Object]" in user-facing toasts.
// `data` itself stays untouched so marker checks (PLAN_EXPIRED etc.) still work.
function toReadableErrorMessage(value) {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : item?.msg || ""))
      .filter(Boolean)
      .join("; ")
  }
  if (value && typeof value === "object") {
    return typeof value.msg === "string" ? value.msg : ""
  }
  return ""
}

function buildApiErrorMessage(data, status) {
  return toReadableErrorMessage(data?.detail)
    || toReadableErrorMessage(data?.error)
    || toReadableErrorMessage(data?.message)
    || `Request failed (${status})`
}

function looksLikeProxyConnectionFailure(data) {
  const message = String(data?.detail || data?.error || data?.message || "")
  return /proxy|econnrefused|failed to fetch|socket hang up|networkerror/i.test(message)
}

function canRetryRequestBody(body) {
  if (!body) return true
  if (typeof body === "string") return true
  if (typeof FormData !== "undefined" && body instanceof FormData) return true
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return true
  if (typeof Blob !== "undefined" && body instanceof Blob) return true
  return false
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function cancelRequest(key) {
  const controller = inFlightControllers.get(key)
  if (controller) {
    controller.abort()
    inFlightControllers.delete(key)
  }
}

async function parseResponseBody(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export async function apiFetch(url, options = {}) {
  const { dedupeKey = "", cancelPrevious = false, ...fetchOptions } = options
  const localApiRequest = isLocalApiRequest(url)
  const directBackendUrl = getLocalDirectBackendUrl(url)
  const resolvedUrl = resolveApiUrl(url)
  const retryUntil = localApiRequest && canRetryRequestBody(fetchOptions.body)
    ? Date.now() + LOCAL_API_RETRY_MS
    : 0
  let controller = null
  let authRefreshAttempted = false
  if (dedupeKey) {
    if (cancelPrevious) {
      cancelRequest(dedupeKey)
    }
    if (!fetchOptions.signal) {
      controller = new AbortController()
      inFlightControllers.set(dedupeKey, controller)
    }
  }

  try {
    while (true) {
      let response
      let requestUrl = resolvedUrl
      try {
        try {
          response = await fetch(requestUrl, {
            ...fetchOptions,
            signal: fetchOptions.signal || controller?.signal,
          })
        } catch (error) {
          if (error?.name === "AbortError") throw error
          if (!directBackendUrl || directBackendUrl === requestUrl) throw error
          requestUrl = directBackendUrl
          response = await fetch(requestUrl, {
            ...fetchOptions,
            signal: fetchOptions.signal || controller?.signal,
          })
        }
      } catch (error) {
        if (error?.name === "AbortError") throw error
        if (localApiRequest && Date.now() < retryUntil) {
          await sleep(LOCAL_API_RETRY_DELAY_MS)
          continue
        }
        if (localApiRequest) {
          throw new ApiError(
            getBackendUnavailableMessage(),
            { status: 0, data: { original_message: error?.message || String(error) } },
          )
        }
        throw error
      }

      if (!response.ok) {
        let data = await parseResponseBody(response.clone())
        if (localApiRequest && response.status === 401 && !authRefreshAttempted && auth?.currentUser?.getIdToken) {
          authRefreshAttempted = true
          try {
            const refreshedToken = await auth.currentUser.getIdToken(true)
            if (refreshedToken) {
              const headers = new Headers(fetchOptions.headers || {})
              headers.set("Authorization", `Bearer ${refreshedToken}`)
              fetchOptions.headers = headers
              if (typeof fetchOptions.body === "string" && headers.get("content-type")?.includes("application/json")) {
                try {
                  const parsedBody = JSON.parse(fetchOptions.body)
                  if (parsedBody && typeof parsedBody === "object" && "id_token" in parsedBody) {
                    parsedBody.id_token = refreshedToken
                    fetchOptions.body = JSON.stringify(parsedBody)
                  }
                } catch {
                  // Caller-managed bodies remain unchanged.
                }
              }
              continue
            }
          } catch {
            // Clear the rejected session below.
          }
        }
        if (localApiRequest && shouldDispatchAuthLogout(response.status, data)) {
          // The backend also uses 403 for plan/credit limits (PLAN_EXPIRED /
          // UPGRADE_REQUIRED) — those are not auth failures and must never
          // trigger a logout.
          window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: "token_rejected", status: response.status } }))
        }
        if (localApiRequest && response.status >= 500 && looksLikeProxyConnectionFailure(data)) {
          if (directBackendUrl && requestUrl !== directBackendUrl) {
            try {
              requestUrl = directBackendUrl
              response = await fetch(directBackendUrl, {
                ...fetchOptions,
                signal: fetchOptions.signal || controller?.signal,
              })
              data = await parseResponseBody(response.clone())
              if (response.ok) return response
              if (!looksLikeProxyConnectionFailure(data)) {
                throw new ApiError(buildApiErrorMessage(data, response.status), { status: response.status, data })
              }
            } catch (error) {
              if (error instanceof ApiError) throw error
              // Fall through to the normal retry/unavailable handling.
            }
          }
          if (Date.now() < retryUntil) {
            await sleep(LOCAL_API_RETRY_DELAY_MS)
            continue
          }
          throw new ApiError(getBackendUnavailableMessage(), { status: response.status, data })
        }
        throw new ApiError(buildApiErrorMessage(data, response.status), { status: response.status, data })
      }
      return response
    }
  } finally {
    if (dedupeKey && controller) {
      const current = inFlightControllers.get(dedupeKey)
      if (current === controller) {
        inFlightControllers.delete(dedupeKey)
      }
    }
  }
}

export async function apiRequest(url, options = {}) {
  const response = await apiFetch(url, options)
  return await parseResponseBody(response) ?? {}
}

export function getApiErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback
  if (typeof error === "string") return error
  if (error.name === "AbortError") return "Request cancelled"
  return error.message || fallback
}
