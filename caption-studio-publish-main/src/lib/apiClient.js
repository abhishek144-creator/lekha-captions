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

export async function apiRequest(url, options = {}) {
  const { dedupeKey = "", cancelPrevious = false, ...fetchOptions } = options
  const localApiRequest = isLocalApiRequest(url)
  const directBackendUrl = getLocalDirectBackendUrl(url)
  const retryUntil = localApiRequest && canRetryRequestBody(fetchOptions.body)
    ? Date.now() + LOCAL_API_RETRY_MS
    : 0
  let controller = null
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
      let data
      let requestUrl = url
      try {
        try {
          response = await fetch(requestUrl, {
            ...fetchOptions,
            signal: fetchOptions.signal || controller?.signal,
          })
          data = await parseResponseBody(response)
        } catch (error) {
          if (error?.name === "AbortError") throw error
          if (!directBackendUrl || directBackendUrl === requestUrl) throw error
          requestUrl = directBackendUrl
          response = await fetch(requestUrl, {
            ...fetchOptions,
            signal: fetchOptions.signal || controller?.signal,
          })
          data = await parseResponseBody(response)
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
        if (response.status === 401 || response.status === 403) {
          // The backend also uses 403 for plan/credit limits (PLAN_EXPIRED /
          // UPGRADE_REQUIRED) — those are not auth failures and must never
          // trigger a logout.
          const errorDetail = String(data?.detail || data?.error || data?.message || "")
          const isPlanLimitError = /PLAN_EXPIRED|UPGRADE_REQUIRED/.test(errorDetail)
          if (!isPlanLimitError) {
            window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: "token_expired", status: response.status } }))
          }
        }
        if (localApiRequest && response.status >= 500 && looksLikeProxyConnectionFailure(data)) {
          if (directBackendUrl && requestUrl !== directBackendUrl) {
            try {
              requestUrl = directBackendUrl
              response = await fetch(directBackendUrl, {
                ...fetchOptions,
                signal: fetchOptions.signal || controller?.signal,
              })
              data = await parseResponseBody(response)
              if (response.ok) return data ?? {}
              if (!looksLikeProxyConnectionFailure(data)) {
                const message =
                  data?.detail ||
                  data?.error ||
                  data?.message ||
                  `Request failed (${response.status})`
                throw new ApiError(message, { status: response.status, data })
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
        const message =
          data?.detail ||
          data?.error ||
          data?.message ||
          `Request failed (${response.status})`
        throw new ApiError(message, { status: response.status, data })
      }
      return data ?? {}
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

export function getApiErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback
  if (typeof error === "string") return error
  if (error.name === "AbortError") return "Request cancelled"
  return error.message || fallback
}
