import { lazy } from 'react'

// A deployed Vite release uses content-hashed filenames. A browser can briefly
// hold an older app shell after a release, which then asks for a chunk that no
// longer exists. Refresh once to fetch the current shell and its matching files.
export function lazyWithRefresh(importer, chunkName) {
  const retryKey = `lekha:chunk-refresh:${chunkName}`

  return lazy(async () => {
    try {
      const module = await importer()
      // A successful import must survive blocked browser storage.
      try { window.sessionStorage.removeItem(retryKey) } catch { /* Optional retry bookkeeping. */ }
      return module
    } catch (error) {
      let canRefresh = false
      if (import.meta.env.PROD) {
        try {
          if (!window.sessionStorage.getItem(retryKey)) {
            window.sessionStorage.setItem(retryKey, '1')
            canRefresh = true
          }
        } catch { /* Without a durable guard, reloading could loop indefinitely. */ }
      }
      if (canRefresh) {
        window.location.reload()
        return new Promise(() => {})
      }

      throw error
    }
  })
}
