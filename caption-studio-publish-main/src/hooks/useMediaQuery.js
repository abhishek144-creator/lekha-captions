import { useEffect, useState } from 'react'

const matches = (query) => (
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false
)

// Tracks a CSS media query. Reads synchronously on first render so the
// editor never mounts the wrong layout for a frame before correcting itself.
export function useMediaQuery(query) {
  const [isMatch, setIsMatch] = useState(() => matches(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mediaQuery = window.matchMedia(query)
    const sync = () => setIsMatch(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [query])

  return isMatch
}

// Tailwind's `lg` breakpoint: the four-column desktop editor. Below it the
// editor uses the bottom dock (MobileDashboardDock).
export const DESKTOP_EDITOR_QUERY = '(min-width: 1024px)'
