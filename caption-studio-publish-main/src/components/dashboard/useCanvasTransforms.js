import { useDocumentGesture } from './useDocumentGesture'

import { useState, useEffect, useCallback } from 'react'

export function useCanvasTransforms({
  setCaptionStyle,
  draggingWord,
  addToHistory,
  captionStyle,
  setCaptions,
  captions,
  captionRef,
  setSnapGuides,
  setCaptionStyleRaw,
  videoRef,
  videoContainerRef,
  setCaptionsRaw,
  previewRenderScale,
}) {
  const startGesture = useDocumentGesture()
  const getViewportScale = useCallback(() => {
    const frame = videoContainerRef.current || videoRef.current?.parentElement
    return frame?.offsetWidth ? frame.getBoundingClientRect().width / frame.offsetWidth : 1
  }, [videoContainerRef, videoRef])
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartPos, setDragStartPos] = useState(0)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartXPos, setDragStartXPos] = useState(0)


  // Custom Element State
  const [draggedElementId, setDraggedElementId] = useState(null)
  const [resizedElementId, setResizedElementId] = useState(null)
  const [elementDragStart, setElementDragStart] = useState({ x: 0, y: 0, initialTop: 0, initialLeft: 0 })
  const [elementResizeStart, setElementResizeStart] = useState({ x: 0, y: 0, initialWidth: 0, initialFontSize: 0, minWidth: 150, direction: 'right' })

  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartY, setResizeStartY] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [resizeStartFontSize, setResizeStartFontSize] = useState(18)
  const [resizeDirection, setResizeDirection] = useState('right')

  const handleMouseDown = (e) => {
    if (!setCaptionStyle || e.target.classList.contains('resize-handle')) return
    // Don't trigger caption drag if we are dragging a word
    if (draggingWord) return

    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (addToHistory) addToHistory()
    setIsDragging(true)
    setDragStartY(e.clientY)
    setDragStartPos(captionStyle?.position_y !== undefined ? captionStyle.position_y : 50)
    setDragStartX(e.clientX)
    setDragStartXPos(captionStyle?.position_x !== undefined ? captionStyle.position_x : 50)
  }

  const handleTextElementMouseDown = (e, elementId, currentStyle) => {
    const isMoveBtn = e.target.closest('.text-element-move-btn')
    if (
      !setCaptions
      || (!isMoveBtn && (
        e.target.classList.contains('text-resize-handle')
        || e.target.closest('button')
        || e.target.closest('[data-word-key]')
        || e.target.closest('[contenteditable="true"]')
      ))
    ) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (addToHistory) addToHistory()
    setDraggedElementId(elementId)
    setElementDragStart({
      x: e.clientX,
      y: e.clientY,
      initialTop: currentStyle.top ?? 50,
      initialLeft: currentStyle.left ?? 50
    })
  }

  const handleTextElementResizeDown = (e, elementId, currentStyle) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (addToHistory) addToHistory()
    setResizedElementId(elementId)
    const measuredWidth = currentStyle.width || 300
    setElementResizeStart({
      x: e.clientX,
      y: e.clientY,
      initialWidth: measuredWidth,
      initialFontSize: currentStyle.fontSize || 18,
      minWidth: currentStyle.minWidth || 40,
      direction: e.currentTarget?.dataset?.resizeEdge || 'right',
    })
  }

  const handleTextElementRotateStart = (e, elementId, currentStyle) => {
    if (!setCaptions) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (addToHistory) addToHistory()

    const elementBox = e.currentTarget.closest('[data-text-element-layer="true"]')
    const rect = elementBox?.getBoundingClientRect()
    if (!rect) return

    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX)
    const initialRotation = currentStyle.rotation || 0

    const handleRotateMove = (moveEvent) => {
      moveEvent.preventDefault()
      const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX)
      const angleDiff = currentAngle - startAngle
      let nextRotation = Math.round(initialRotation + (angleDiff * 180 / Math.PI))

      if (moveEvent.shiftKey) {
        nextRotation = Math.round(nextRotation / 15) * 15
      }

      const rotateUpdater = setCaptionsRaw || setCaptions
      rotateUpdater(prev => prev.map(c => {
        if (c.id !== elementId) return c
        return {
          ...c,
          customStyle: {
            ...c.customStyle,
            rotation: nextRotation
          }
        }
      }))
    }

    startGesture({ onMove: handleRotateMove, cursor: 'grabbing' })
  }

  const handleResizeMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (addToHistory) addToHistory()
    const measuredWidth = captionStyle?.boxWidth || 300
    setIsResizing(true)
    setResizeStartX(e.clientX)
    setResizeStartY(e.clientY)
    setResizeStartWidth(measuredWidth)
    setResizeStartFontSize(captionStyle?.font_size || 18)
    setResizeDirection(e.currentTarget?.dataset?.resizeEdge || 'right')
  }

  // Global Mouse Move / Up for all dragging operations
  useEffect(() => {
    if ((!isDragging && !draggedElementId && !resizedElementId) || (!setCaptionStyle && !setCaptions)) return

    const SNAP_THRESHOLD_PCT = 2.5; // % within which to snap
    const getSnapGuides = (axis, value, excludeId) => {
      // Static snap targets
      const targets = axis === 'y'
        ? [5, 50, 75, 95]
        : [5, 50, 95]
      // Add other elements
      if (captions) {
        captions.forEach(c => {
          if (c.isTextElement && c.id !== excludeId && c.customStyle) {
            if (axis === 'x' && c.customStyle.left != null) targets.push(c.customStyle.left)
            if (axis === 'y' && c.customStyle.top != null) targets.push(c.customStyle.top)
          }
        })
      }
      for (const t of targets) {
        if (Math.abs(value - t) <= SNAP_THRESHOLD_PCT) {
          return { snapped: true, value: t }
        }
      }
      return { snapped: false, value }
    }

    const handleMouseMove = (e) => {
      // 1. Handle Caption Full Drag (X and Y)
      if (isDragging) {
        const videoContainer = captionRef.current?.parentElement
        if (!videoContainer) return

        const containerHeight = videoContainer.getBoundingClientRect().height || 1
        const containerWidth = videoContainer.getBoundingClientRect().width || 1

        const deltaY = e.clientY - dragStartY
        const deltaPercentY = (deltaY / containerHeight) * 100
        let newPosY = dragStartPos + deltaPercentY
        newPosY = Math.max(5, Math.min(95, newPosY))

        const deltaX = e.clientX - dragStartX
        const deltaPercentX = (deltaX / containerWidth) * 100
        let newPosX = dragStartXPos + deltaPercentX
        newPosX = Math.max(5, Math.min(95, newPosX))

        // Snap check for Y and X axis
        const ySnap = getSnapGuides('y', newPosY, null)
        const xSnap = getSnapGuides('x', newPosX, null)

        let hLines = []
        let vLines = []

        if (ySnap.snapped) {
          newPosY = ySnap.value
          hLines.push(newPosY)
        }
        if (xSnap.snapped) {
          newPosX = xSnap.value
          vLines.push(newPosX)
        }

        setSnapGuides({ hLines, vLines })

        const styleUpdater = setCaptionStyleRaw || setCaptionStyle
        styleUpdater(prev => ({
          ...prev,
          position_y: Math.round(newPosY),
          position_x: Math.round(newPosX)
        }))
      }

      // 3. Handle Text Element Drag
      if (draggedElementId && setCaptions) {
        const videoContainer = videoRef.current?.parentElement
        if (!videoContainer) return

        const containerWidth = videoContainer.getBoundingClientRect().width || 1
        const containerHeight = videoContainer.getBoundingClientRect().height || 1
        const deltaX = e.clientX - elementDragStart.x
        const deltaY = e.clientY - elementDragStart.y
        const deltaPercentX = (deltaX / containerWidth) * 100
        const deltaPercentY = (deltaY / containerHeight) * 100

        let newLeft = elementDragStart.initialLeft + deltaPercentX
        let newTop = elementDragStart.initialTop + deltaPercentY
        newLeft = Math.max(5, Math.min(95, newLeft))
        newTop = Math.max(5, Math.min(95, newTop))

        // Snap checks for X and Y
        const xSnap = getSnapGuides('x', newLeft, draggedElementId)
        const ySnap = getSnapGuides('y', newTop, draggedElementId)
        if (xSnap.snapped) newLeft = xSnap.value
        if (ySnap.snapped) newTop = ySnap.value
        setSnapGuides({
          hLines: ySnap.snapped ? [newTop] : [],
          vLines: xSnap.snapped ? [newLeft] : []
        })

        const captionUpdater = setCaptionsRaw || setCaptions
        captionUpdater(prev => prev.map(c => {
          if (c.id !== draggedElementId) return c
          return {
            ...c,
            customStyle: {
              ...c.customStyle,
              left: newLeft,
              top: newTop
            }
          }
        }))
      }

      // 4. Handle Text Element Resize
      if (resizedElementId && setCaptions) {
        const deltaX = e.clientX - elementResizeStart.x
        const deltaY = e.clientY - elementResizeStart.y
        const resizeDelta = (() => {
          switch (elementResizeStart.direction) {
            case 'left':
              return -deltaX
            case 'top':
              return -deltaY
            case 'bottom':
              return deltaY
            case 'top-left':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : -deltaY
            case 'top-right':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY
            case 'bottom-left':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : deltaY
            case 'bottom-right':
            case 'corner':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY
            case 'right':
            default:
              return deltaX
          }
        })()

        const isHorizontalFrameResize = ['left', 'right'].includes(elementResizeStart.direction)
        const minFrameWidth = isHorizontalFrameResize ? 28 : Math.min(elementResizeStart.minWidth || 150, 80)
        const unscaledDelta = resizeDelta / Math.max(previewRenderScale * getViewportScale(), 0.001)
        let newWidth = elementResizeStart.initialWidth + (isHorizontalFrameResize ? unscaledDelta * 2 : unscaledDelta)
        newWidth = Math.max(minFrameWidth, Math.min(600, newWidth))

        const widthRatio = newWidth / Math.max(elementResizeStart.initialWidth, 1)
        let newFontSize = elementResizeStart.initialFontSize * widthRatio
        newFontSize = Math.max(12, Math.min(60, newFontSize))

        const captionUpdater = setCaptionsRaw || setCaptions
        captionUpdater(prev => prev.map(c => {
          if (c.id !== resizedElementId) return c
          return {
            ...c,
            customStyle: {
              ...c.customStyle,
              width: newWidth,
              ...(isHorizontalFrameResize ? {} : { fontSize: newFontSize })
            }
          }
        }))
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setDraggedElementId(null)
      setResizedElementId(null)
      setSnapGuides({ hLines: [], vLines: [] }); // clear guides
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('pointermove', handleMouseMove, { passive: false })
    document.addEventListener('pointerup', handleMouseUp)
    document.addEventListener('pointercancel', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('pointermove', handleMouseMove)
      document.removeEventListener('pointerup', handleMouseUp)
      document.removeEventListener('pointercancel', handleMouseUp)
    }
  }, [isDragging, dragStartY, dragStartPos, dragStartX, dragStartXPos, captions, setCaptionStyleRaw, setCaptionsRaw, setCaptionStyle, setCaptions, draggedElementId, resizedElementId, elementDragStart, elementResizeStart, previewRenderScale, getViewportScale])

  useEffect(() => {
    if (!isResizing || !setCaptionStyle) return

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizeStartX
      const deltaY = e.clientY - resizeStartY
      const resizeDelta = (() => {
        switch (resizeDirection) {
          case 'left':
            return -deltaX
          case 'top':
            return -deltaY
          case 'bottom':
            return deltaY
          case 'top-left':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : -deltaY
          case 'top-right':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY
          case 'bottom-left':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : deltaY
          case 'bottom-right':
          case 'corner':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY
          case 'right':
          default:
            return deltaX
        }
      })()

      const isHorizontalFrameResize = ['left', 'right'].includes(resizeDirection)
      const minFrameWidth = isHorizontalFrameResize ? 180 : 80
      const unscaledDelta = resizeDelta / Math.max(previewRenderScale * getViewportScale(), 0.001)
      let newWidth = resizeStartWidth + (isHorizontalFrameResize ? unscaledDelta * 2 : unscaledDelta)
      newWidth = Math.max(minFrameWidth, Math.min(600, newWidth))

      // Calculate proportional font size change
      const safeStartWidth = Math.max(resizeStartWidth, 1)
      const widthRatio = newWidth / safeStartWidth
      let newFontSize = resizeStartFontSize * widthRatio
      newFontSize = Math.max(12, Math.min(60, newFontSize))

      const styleUpdater = setCaptionStyleRaw || setCaptionStyle
      styleUpdater(prev => ({
        ...prev,
        boxWidth: newWidth,
        ...(isHorizontalFrameResize ? {} : { font_size: newFontSize })
      }))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('pointermove', handleMouseMove, { passive: false })
    document.addEventListener('pointerup', handleMouseUp)
    document.addEventListener('pointercancel', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('pointermove', handleMouseMove)
      document.removeEventListener('pointerup', handleMouseUp)
      document.removeEventListener('pointercancel', handleMouseUp)
    }
  }, [isResizing, resizeDirection, resizeStartFontSize, resizeStartWidth, resizeStartX, resizeStartY, setCaptionStyle, setCaptionStyleRaw, previewRenderScale, getViewportScale])


  return { isDragging, draggedElementId, resizedElementId, isResizing, handleMouseDown, handleResizeMouseDown, handleTextElementMouseDown, handleTextElementResizeDown, handleTextElementRotateStart }
}
