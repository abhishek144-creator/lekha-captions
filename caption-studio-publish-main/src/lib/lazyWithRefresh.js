import { lazy } from 'react'

// A deployed Vite release uses content-hashed filenames. A browser can briefly
// hold an older app shell after a release, which then asks for a chunk that no
// longer exists. Refresh once to fetch the current shell and its matching files.
export function lazyWithRefresh(importer, chunkName) {
  const retryKey = `lekha:chunk-refresh:${chunkName}`

  return lazy(async () => {
    try {
      const module = await importer()
      window.sessionStorage.removeItem(retryKey)
      return module
    } catch (error) {
      if (import.meta.env.PROD && !window.sessionStorage.getItem(retryKey)) {
        window.sessionStorage.setItem(retryKey, '1')
        window.location.reload()
        return new Promise(() => {})
      }

      throw error
    }
  })
}
