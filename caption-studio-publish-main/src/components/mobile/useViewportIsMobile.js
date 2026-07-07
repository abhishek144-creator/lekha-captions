import { useEffect, useState } from 'react'

export const MOBILE_EDITOR_BREAKPOINT = 768

// A device counts as mobile when the viewport is narrow, OR when it is a
// touch device whose smaller screen dimension is phone-sized. The second
// clause keeps phones on the mobile editor in landscape (e.g. 812×375) —
// crossing over to the desktop Dashboard mid-session would wipe the saved
// editor state on mount.
const readIsMobile = () => {
  if (typeof window === 'undefined') return false
  if (window.innerWidth < MOBILE_EDITOR_BREAKPOINT) return true
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
  const minScreenDimension = Math.min(window.screen?.width || Infinity, window.screen?.height || Infinity)
  return isCoarsePointer && minScreenDimension < MOBILE_EDITOR_BREAKPOINT
}

// Synchronous initial value so the router picks the right editor on first
// render (no desktop-editor flash on phones, no mobile flash on desktop)
export function useViewportIsMobile() {
  const [isMobile, setIsMobile] = useState(readIsMobile)

  useEffect(() => {
    const onChange = () => setIsMobile(readIsMobile())
    const mql = window.matchMedia(`(max-width: ${MOBILE_EDITOR_BREAKPOINT - 1}px)`)
    mql.addEventListener('change', onChange)
    window.addEventListener('orientationchange', onChange)
    return () => {
      mql.removeEventListener('change', onChange)
      window.removeEventListener('orientationchange', onChange)
    }
  }, [])

  return isMobile
}
