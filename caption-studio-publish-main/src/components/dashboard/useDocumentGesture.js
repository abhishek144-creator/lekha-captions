import { useCallback, useEffect, useRef } from 'react'

// One native gesture per controller. Always release listeners and body styles
// on completion, cancellation, replacement or editor unmount.
export function useDocumentGesture() {
  const cleanupRef = useRef(null)
  useEffect(() => () => cleanupRef.current?.(), [])

  return useCallback(({ onMove, onEnd, onCancel = onEnd, cursor }) => {
    cleanupRef.current?.()
    const previousCursor = document.body.style.cursor
    const previousSelection = document.body.style.userSelect
    if (cursor) document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'
    let active = true
    const cleanup = () => {
      if (!active) return
      active = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', finish)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelection
      if (cleanupRef.current === cleanup) cleanupRef.current = null
    }
    const finish = event => {
      if (!active) return
      cleanup()
      onEnd?.(event)
    }
    const cancel = event => {
      if (!active) return
      cleanup()
      onCancel?.(event)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', finish)
    document.addEventListener('pointermove', onMove, { passive: false })
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', cancel)
    cleanupRef.current = cleanup
    return cleanup
  }, [])
}
