export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message || "Request failed")
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

const inFlightControllers = new Map()

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

  let response
  let data
  try {
    response = await fetch(url, {
      ...fetchOptions,
      signal: fetchOptions.signal || controller?.signal,
    })
    data = await parseResponseBody(response)
  } finally {
    if (dedupeKey && controller) {
      const current = inFlightControllers.get(dedupeKey)
      if (current === controller) {
        inFlightControllers.delete(dedupeKey)
      }
    }
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.error ||
      data?.message ||
      `Request failed (${response.status})`
    throw new ApiError(message, { status: response.status, data })
  }
  return data ?? {}
}

export function getApiErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback
  if (typeof error === "string") return error
  if (error.name === "AbortError") return "Request cancelled"
  return error.message || fallback
}
