import { useDocumentGesture } from './useDocumentGesture'
import { measureWordInkBox, resolveCptWordSnap } from './cptSmartGuides'
import { settleSourceTemplateWord } from './videoPlayerWordEditing'

import { useCallback } from 'react'

export function useWordGestures({
  selectedDetachedWord,
  setDraggingWord,
  setResizingWord,
  setCaptions,
  wordResizeActiveRef,
  addToHistory,
  videoContainerRef,
  getSelectedDetachedWordViewport,
  previewRenderScale,
  setCaptionsRaw,
  isPlayingRef,
  videoRef,
  setIsPlaying,
  getWordRenderOffset,
  captionStyle,
  currentDragCoordinates,
  canvasSize,
  fitCanvasSizeRef,
  setSnapGuides,
  setCptWordGuides,
  lastDragDropTime,
}) {
  const startGesture = useDocumentGesture()
  const handleDetachedWordResizeStart = (e) => {
    if (!selectedDetachedWord || !setCaptions) return
    e.preventDefault()
    e.stopPropagation()
    if (wordResizeActiveRef.current) return

    const handle = e.currentTarget
    const resizeAxis = handle.dataset.resizeAxis || 'corner'
    const selectionBox = handle.closest('[data-selected-word-box="true"]')
    const textNode = selectionBox?.querySelector('[data-selected-word-text="true"]')
    if (!selectionBox || !textNode) return

    wordResizeActiveRef.current = true
    if (addToHistory) addToHistory()

    const captionId = selectedDetachedWord.caption.id
    const wordIndex = selectedDetachedWord.wordIndex
    const startX = e.clientX
    const startY = e.clientY
    const startRect = selectionBox.getBoundingClientRect()
    const startTextRect = textNode.getBoundingClientRect()
    const videoRect = videoContainerRef.current?.getBoundingClientRect()
    const viewportScale = getSelectedDetachedWordViewport()?.scale || 1
    const renderScale = Math.max(previewRenderScale * viewportScale, 0.001)
    const initialFontSize = selectedDetachedWord.fontSize
    const minTextboxWidth = 24
    const initialBoxWidth = Math.max(minTextboxWidth, selectedDetachedWord.boxWidth || (startRect.width / renderScale) || Math.ceil(startTextRect.width / renderScale) || 80)
    const startCenterClientX = startRect.left + startRect.width / 2
    const startCenterClientY = startRect.top + startRect.height / 2
    const isLeftHandle = handle.dataset.resizeSide === 'left'
    const isTopHandle = handle.dataset.resizeSide === 'top'

    setResizingWord({
      captionId,
      wordIndex,
      startX,
      startY,
      initialFontSize,
      axis: resizeAxis,
    })

    const writeWordStyle = (producer) => {
      const captionUpdater = setCaptionsRaw || setCaptions
      captionUpdater(prev => prev.map(c => {
        if (c.id !== captionId) return c
        const wordStyles = c.wordStyles || {}
        const styleKey = `${c.id}-${wordIndex}`
        const currentWordStyle = wordStyles[styleKey] || {}
        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: producer(currentWordStyle),
          },
        }
      }))
    }

    const handleResizeMove = (moveEvent) => {
      moveEvent.preventDefault()
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      if (resizeAxis === 'horizontal') {
        const signedDeltaX = isLeftHandle ? -deltaX : deltaX
        const nextBoxWidth = Math.max(minTextboxWidth, Math.min(520, Math.round(initialBoxWidth + signedDeltaX / renderScale)))
        const widthDeltaPx = (nextBoxWidth - initialBoxWidth) * renderScale
        const nextCenterClientX = startCenterClientX + (isLeftHandle ? -widthDeltaPx / 2 : widthDeltaPx / 2)
        const nextAbsXPct = videoRect?.width
          ? Math.max(0, Math.min(100, ((nextCenterClientX - videoRect.left) / videoRect.width) * 100))
          : selectedDetachedWord.x
        const nextAbsYPct = videoRect?.height
          ? Math.max(0, Math.min(100, ((startCenterClientY - videoRect.top) / videoRect.height) * 100))
          : selectedDetachedWord.y
        selectionBox.style.width = `${nextBoxWidth * renderScale}px`
        selectionBox.style.left = `${nextCenterClientX}px`
        textNode.style.width = '100%'
        textNode.style.transform = ''
        selectionBox.style.overflow = 'visible'
        selectionBox.style.textAlign = 'center'
        selectionBox.style.whiteSpace = 'normal'
        selectionBox.style.overflowWrap = 'anywhere'
        selectionBox.style.wordBreak = 'break-all'

        writeWordStyle((currentWordStyle) => ({
          ...currentWordStyle,
          boxWidth: nextBoxWidth,
          textScaleX: 1,
          abs_x_pct: nextAbsXPct,
          abs_y_pct: nextAbsYPct,
        }))
        return
      }

      const signedDeltaX = isLeftHandle ? -deltaX : deltaX
      const signedDeltaY = isTopHandle ? -deltaY : deltaY
      const dominantDelta = Math.abs(signedDeltaX) >= Math.abs(signedDeltaY) ? signedDeltaX : signedDeltaY
      const startMeasure = Math.max(startTextRect.width, startTextRect.height, 1)
      const scale = Math.max(0.35, Math.min(5, (startMeasure + dominantDelta) / startMeasure))
      const nextFontSize = Math.max(8, Math.min(140, Math.round(initialFontSize * scale)))

      selectionBox.style.fontSize = `${nextFontSize * renderScale}px`
      selectionBox.style.width = 'max-content'
      textNode.style.width = 'auto'
      textNode.style.transform = ''
      selectionBox.style.whiteSpace = 'nowrap'
      selectionBox.style.overflowWrap = 'normal'
      selectionBox.style.wordBreak = 'normal'

      writeWordStyle((currentWordStyle) => {
        const nextWordStyle = {
          ...currentWordStyle,
          fontSize: nextFontSize,
          frozenFontSize: nextFontSize,
        }
        delete nextWordStyle.boxWidth
        delete nextWordStyle.textScaleX
        return nextWordStyle
      })
    }

    const handleResizeEnd = () => {
      wordResizeActiveRef.current = false
      setResizingWord(null)
    }

    startGesture({ onMove: handleResizeMove, onEnd: handleResizeEnd, cursor: resizeAxis === 'horizontal' ? 'ew-resize' : 'nwse-resize' })
  }

  const handleDetachedWordRotateStart = (e) => {
    if (!selectedDetachedWord || !setCaptions) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (addToHistory) addToHistory()

    const captionId = selectedDetachedWord.caption.id
    const wordIndex = selectedDetachedWord.wordIndex
    const box = e.currentTarget.closest('[data-selected-word-box="true"]')
    const rect = box?.getBoundingClientRect()
    if (!rect) return

    const startX = e.clientX
    const startY = e.clientY
    const initialRotation = selectedDetachedWord.rotation || 0

    box.style.transformOrigin = 'center center'

    const handleRotateMove = (moveEvent) => {
      moveEvent.preventDefault()
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      const nextRotation = Math.round(initialRotation + ((deltaX + deltaY) * 0.55))
      box.style.transform = `translate(-50%, -50%) rotate(${nextRotation}deg)`
      box.style.transformOrigin = 'center center'

      const rotateUpdater = setCaptionsRaw || setCaptions
      rotateUpdater(prev => prev.map(c => {
        if (c.id !== captionId) return c
        const wordStyles = c.wordStyles || {}
        const styleKey = `${c.id}-${wordIndex}`
        const currentWordStyle = wordStyles[styleKey] || {}

        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: {
              ...currentWordStyle,
              rotation: nextRotation,
            }
          }
        }
      }))
    }

    startGesture({ onMove: handleRotateMove, cursor: 'grabbing' })
  }

  const handleSelectedDetachedWordDelete = useCallback(() => {
    if (!selectedDetachedWord || !setCaptions) return
    if (addToHistory) addToHistory()

    const captionUpdater = setCaptionsRaw || setCaptions
    captionUpdater(prev => prev.map(c => {
      if (c.id !== selectedDetachedWord.caption.id) return c
      const wordStyles = c.wordStyles || {}
      const styleKey = `${c.id}-${selectedDetachedWord.wordIndex}`
      const currentWordStyle = wordStyles[styleKey] || {}
      const nextWordStyle = { ...currentWordStyle }

      delete nextWordStyle.abs_x_pct
      delete nextWordStyle.abs_y_pct
      delete nextWordStyle.x
      delete nextWordStyle.y
      delete nextWordStyle.x_pct
      delete nextWordStyle.y_pct
      delete nextWordStyle.boxWidth
      delete nextWordStyle.textScaleX
      delete nextWordStyle.rotation
      delete nextWordStyle.isLocked

      return {
        ...c,
        wordStyles: {
          ...wordStyles,
          [styleKey]: nextWordStyle
        }
      }
    }))
  }, [addToHistory, selectedDetachedWord, setCaptions, setCaptionsRaw])


  function handleWordMouseDown(e, caption, wordIndex, isElement = false, isDetached = false, dragSource = 'direct') {
    if (!setCaptions) return
    e.preventDefault()
    e.stopPropagation()
    // Capture is a nicety; the gesture itself is tracked on the document. A
    // pointer that has already ended (or a synthetic start) must not abort it.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* see above */ }

    // A word drag enters editing mode. Stop playback so the canvas stays stable
    // while the word is positioned and the committed CPT can be inspected.
    const editingRoot = videoContainerRef.current
    const ownsCptDragMarker = Boolean(editingRoot && !isElement)
    if (editingRoot) {
      const captionWordPrefix = `${caption.id}-`
      if (ownsCptDragMarker) editingRoot.dataset.cptDragCaption = String(caption.id)
      editingRoot.querySelectorAll('[data-word-key]').forEach((node) => {
        if (!String(node.getAttribute('data-word-key') || '').startsWith(captionWordPrefix)) return
        node.style.setProperty('opacity', '1', 'important')
        // Measure template words at rest, the state they keep after the drop
        // (and in export). Mid-entrance rects put the drop and guides off.
        if (ownsCptDragMarker && node.hasAttribute('data-source-word-index')) settleSourceTemplateWord(node)
      })
    }
    const clearCptDragMarker = () => {
      if (ownsCptDragMarker && editingRoot.dataset.cptDragCaption === String(caption.id)) {
        delete editingRoot.dataset.cptDragCaption
      }
    }
    if (isPlayingRef.current) {
      videoRef.current?.pause()
      setIsPlaying(false)
    }

    const customStyle = caption?.wordStyles?.[`${caption?.id}-${wordIndex}`] || {}
    const renderedOffset = getWordRenderOffset(customStyle)

    // Use the element that received the event directly
    const targetElement = e.currentTarget
    if (!targetElement) return
    const sourceTemplateVisualElement = dragSource === 'source-template'
      ? targetElement.querySelector('[data-source-word-visual="true"], .kf-base, .kf-fill')
      : null
    const dragPreviewElement = isDetached
      ? targetElement
      : targetElement.querySelector('[data-word-drag-visual="true"]') || targetElement
    const dragMovementElement = dragSource === 'source-template'
      ? targetElement
      : dragPreviewElement
    const dragMeasurementElement = sourceTemplateVisualElement || dragPreviewElement
    const isFixedWordEditorDrag = dragMovementElement.matches?.('[data-selected-word-box="true"]') === true
    const initialInlineTransform = dragPreviewElement.style.transform
    const initialInlineTranslate = dragMovementElement.style.getPropertyValue('translate')
    const initialInlineTranslatePriority = dragMovementElement.style.getPropertyPriority('translate')
    const restoreInlineTranslate = () => {
      if (initialInlineTranslate) {
        dragMovementElement.style.setProperty(
          'translate',
          initialInlineTranslate,
          initialInlineTranslatePriority
        )
      } else {
        dragMovementElement.style.removeProperty('translate')
      }
    }

    if (
      dragSource !== 'source-template'
      && captionStyle?.template_id
      && !isElement
      && !isDetached
    ) {
      const computedStyle = window.getComputedStyle(dragMeasurementElement)
      const styleKey = `${caption.id}-${wordIndex}`
      const captionUpdater = setCaptionsRaw || setCaptions
      captionUpdater(prev => prev.map(c => {
        if (c.id !== caption.id) return c
        const wordStyles = c.wordStyles || {}
        const currentWordStyle = wordStyles[styleKey] || {}
        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: {
              ...currentWordStyle,
              fontFamily: currentWordStyle.fontFamily || computedStyle.fontFamily,
              fontWeight: currentWordStyle.fontWeight || computedStyle.fontWeight,
              fontStyle: currentWordStyle.fontStyle || computedStyle.fontStyle,
              textTransform: currentWordStyle.textTransform || computedStyle.textTransform,
              color: currentWordStyle.color || computedStyle.color,
              templateBlockClass: targetElement.dataset.templateBlockClass || currentWordStyle.templateBlockClass,
              templateBlockType: targetElement.dataset.templateBlockType || currentWordStyle.templateBlockType,
              templateWordClass: targetElement.dataset.templateWordClass || currentWordStyle.templateWordClass,
            }
          }
        }
      }))
    }

    // Immediately create the dragging state
    const dragState = {
      captionId: caption.id,
      wordIndex,
      startX: e.clientX,
      startY: e.clientY,
      initialX: renderedOffset.x || 0,
      initialY: renderedOffset.y || 0,
      isElement,
      isDetached,
      dragSource,
      targetElement
    }

    setDraggingWord(dragState)
    currentDragCoordinates.current = { x: dragState.initialX, y: dragState.initialY }
    let hasMoved = false
    let hasRecordedHistory = false

    const videoContainer = videoContainerRef.current || videoRef.current?.parentElement
    const containerWidth = videoContainer?.offsetWidth || canvasSize.width || 1
    const containerHeight = videoContainer?.offsetHeight || canvasSize.height || 1
    const baselineWidth = fitCanvasSizeRef.current.width || containerWidth
    const baselineHeight = fitCanvasSizeRef.current.height || containerHeight
    const containerRectAtStart = videoContainer?.getBoundingClientRect()
    const viewportScaleX = containerRectAtStart?.width
      ? containerRectAtStart.width / containerWidth
      : 1
    const viewportScaleY = containerRectAtStart?.height
      ? containerRectAtStart.height / containerHeight
      : viewportScaleX
    const wordRectAtStart = dragMeasurementElement.getBoundingClientRect()
    // Snapping uses the visible letters (so stacked words can sit tight); the
    // drop position still comes from the element's own centre (wordRectAtStart).
    const snapRectAtStart = measureWordInkBox(dragMeasurementElement) || wordRectAtStart
    // Snapshot sibling visuals once. Measuring during DOM mutation would make
    // snapping depend on the previous pointer event and double saved offsets.
    const siblingRects = []
    const seenWordKeys = new Set()
    videoContainer?.querySelectorAll('[data-word-key]').forEach(node => {
      const key = node.getAttribute('data-word-key') || ''
      if (!key.startsWith(`${caption.id}-`) || key === `${caption.id}-${wordIndex}` || seenWordKeys.has(key)) return
      const visual = node.querySelector('[data-source-word-visual="true"], [data-word-drag-visual="true"], .kf-base') || node
      const computed = window.getComputedStyle(visual)
      const rect = visual.getBoundingClientRect()
      if (computed.visibility === 'hidden' || Number(computed.opacity) === 0 || !rect.width || !rect.height) return
      seenWordKeys.add(key)
      siblingRects.push(measureWordInkBox(visual) || rect)
    })
    const resolveDelta = (deltaX, deltaY, bypassSnap = false) => bypassSnap
      ? { deltaX, deltaY, guides: [] }
      : resolveCptWordSnap({ draggedRect: snapRectAtStart, siblingRects, frameRect: containerRectAtStart, deltaX, deltaY })
    const canvasGuides = guides => guides.map(guide => ({
      ...guide,
      ...(guide.x != null ? { x: (guide.x - containerRectAtStart.left) / viewportScaleX } : {}),
      ...(guide.x1 != null ? { x1: (guide.x1 - containerRectAtStart.left) / viewportScaleX } : {}),
      ...(guide.x2 != null ? { x2: (guide.x2 - containerRectAtStart.left) / viewportScaleX } : {}),
      ...(guide.y != null ? { y: (guide.y - containerRectAtStart.top) / viewportScaleY } : {}),
      ...(guide.y1 != null ? { y1: (guide.y1 - containerRectAtStart.top) / viewportScaleY } : {}),
      ...(guide.y2 != null ? { y2: (guide.y2 - containerRectAtStart.top) / viewportScaleY } : {}),
    }))
    const startCenterXPct = containerRectAtStart?.width
      ? ((wordRectAtStart.left + wordRectAtStart.width / 2 - containerRectAtStart.left) / containerRectAtStart.width) * 100
      : 50
    const startCenterYPct = containerRectAtStart?.height
      ? ((wordRectAtStart.top + wordRectAtStart.height / 2 - containerRectAtStart.top) / containerRectAtStart.height) * 100
      : 50

    const handleNativeMouseMove = (moveEvent) => {
      moveEvent.preventDefault()
      const deltaX = moveEvent.clientX - dragState.startX
      const deltaY = moveEvent.clientY - dragState.startY

      if (!hasMoved && Math.abs(deltaX) <= 3 && Math.abs(deltaY) <= 3) {
        return
      }

      if (!hasMoved) {
        hasMoved = true
        if (!hasRecordedHistory && addToHistory) {
          addToHistory()
          hasRecordedHistory = true
        }
      }

      const snapped = resolveDelta(deltaX, deltaY, moveEvent.altKey)
      const adjustedClientDeltaX = snapped.deltaX
      const adjustedClientDeltaY = snapped.deltaY
      const adjustedDeltaX = adjustedClientDeltaX / (isFixedWordEditorDrag ? 1 : viewportScaleX)
      const adjustedDeltaY = adjustedClientDeltaY / (isFixedWordEditorDrag ? 1 : viewportScaleY)
      const newX = dragState.initialX + adjustedDeltaX
      const newY = dragState.initialY + adjustedDeltaY

      currentDragCoordinates.current = {
        x: newX,
        y: newY,
        deltaX: adjustedDeltaX,
        deltaY: adjustedDeltaY,
        clientDeltaX: adjustedClientDeltaX,
        clientDeltaY: adjustedClientDeltaY,
      }
      setSnapGuides({ hLines: [], vLines: [] })
      setCptWordGuides(containerRectAtStart ? canvasGuides(snapped.guides) : [])

      // Directly manipulate the DOM for zero-latency dragging
      if (dragState.dragSource === 'source-template') {
        // Source-template visuals already contain their saved x/y translation.
        // Move the stable outer anchor by only this gesture's delta so an
        // existing offset is never applied twice during a second drag.
        dragMovementElement.style.setProperty(
          'translate',
          `${adjustedDeltaX}px ${adjustedDeltaY}px`,
          'important'
        )
      } else if (dragState.isElement) {
        dragPreviewElement.style.setProperty(
          'transform',
          `translate(${newX}px, ${newY}px)`,
          'important'
        )
      } else {
        // The word may come from an inline template, an absolutely centered
        // caption, or the fixed selected-word portal. CSS `translate` composes
        // with all of those authored transforms without replacing their anchor.
        dragMovementElement.style.setProperty(
          'translate',
          `${adjustedDeltaX}px ${adjustedDeltaY}px`,
          'important'
        )
      }
    }

    const handleNativeMouseUp = (upEvent) => {

      // Now perform the final React state update to save the new coordinates
      if (hasMoved) {
        const previousCoords = currentDragCoordinates.current
        const releaseClientDeltaX = Number.isFinite(upEvent?.clientX)
          ? upEvent.clientX - dragState.startX
          : (Number(previousCoords?.clientDeltaX) || 0)
        const releaseClientDeltaY = Number.isFinite(upEvent?.clientY)
          ? upEvent.clientY - dragState.startY
          : (Number(previousCoords?.clientDeltaY) || 0)
        // Resolve the final pointer event with the same snapshot and resolver
        // as the live preview, including a pointer-up beyond the last move.
        const released = resolveDelta(releaseClientDeltaX, releaseClientDeltaY, upEvent?.altKey)
        const finalCoords = {
          x: dragState.initialX + released.deltaX / (isFixedWordEditorDrag ? 1 : viewportScaleX),
          y: dragState.initialY + released.deltaY / (isFixedWordEditorDrag ? 1 : viewportScaleY),
          deltaX: released.deltaX / (isFixedWordEditorDrag ? 1 : viewportScaleX),
          deltaY: released.deltaY / (isFixedWordEditorDrag ? 1 : viewportScaleY),
          clientDeltaX: released.deltaX,
          clientDeltaY: released.deltaY,
        }
        if (finalCoords) {
          const parentFontSize = isElement
            ? (caption.customStyle?.fontSize || 18)
            : (captionStyle?.font_size || 18)

          const containerRect = videoContainer?.getBoundingClientRect()
          // Derive the committed position from the same start rectangle and
          // snapped delta used by the live preview. Reading the mutated DOM here
          // is unreliable for template words whose animation/transform can
          // change between pointermove and pointerup.
          const finalDeltaX = Number(finalCoords.clientDeltaX) || 0
          const finalDeltaY = Number(finalCoords.clientDeltaY) || 0
          const absXPct = containerRect?.width
            ? ((wordRectAtStart.left + wordRectAtStart.width / 2 + finalDeltaX - containerRect.left) / containerRect.width) * 100
            : undefined
          const absYPct = containerRect?.height
            ? ((wordRectAtStart.top + wordRectAtStart.height / 2 + finalDeltaY - containerRect.top) / containerRect.height) * 100
            : undefined
          const detachedPositionDeltaPct = (
            typeof absXPct === 'number'
            && typeof absYPct === 'number'
          )
            ? Math.max(
                Math.abs(absXPct - startCenterXPct),
                Math.abs(absYPct - startCenterYPct)
              )
            : 0
          const shouldDetachWord = (
            dragState.dragSource !== 'source-template'
            && !dragState.isElement
            && detachedPositionDeltaPct > 0.75
          )

          const captionUpdater = setCaptionsRaw || setCaptions
          captionUpdater(prev => prev.map(c => {
            if (c.id !== dragState.captionId) return c
            const wordStyles = c.wordStyles || {}
            const styleKey = `${c.id}-${dragState.wordIndex}`
            const currentWordStyle = wordStyles[styleKey] || {}
            const nextWordStyle = dragState.dragSource === 'source-template'
              ? {
                  ...currentWordStyle,
                  x: (finalCoords.x / containerWidth) * baselineWidth,
                  y: (finalCoords.y / containerHeight) * baselineHeight,
                  x_pct: (finalCoords.x / containerWidth) * 100,
                  y_pct: (finalCoords.y / containerHeight) * 100,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                }
              : dragState.isElement
              ? {
                  ...currentWordStyle,
                  x: (finalCoords.x / containerWidth) * baselineWidth,
                  y: (finalCoords.y / containerHeight) * baselineHeight,
                  x_pct: (finalCoords.x / containerWidth) * 100,
                  y_pct: (finalCoords.y / containerHeight) * 100,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                }
              : shouldDetachWord ? {
                  ...currentWordStyle,
                  x: 0,
                  y: 0,
                  x_pct: 0,
                  y_pct: 0,
                  abs_x_pct: typeof absXPct === 'number' ? absXPct : currentWordStyle.abs_x_pct,
                  abs_y_pct: typeof absYPct === 'number' ? absYPct : currentWordStyle.abs_y_pct,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                } : {
                  ...currentWordStyle,
                  x: 0,
                  y: 0,
                  x_pct: 0,
                  y_pct: 0,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                }
            if (
              !dragState.isElement
              && typeof absXPct === 'number'
              && typeof absYPct === 'number'
            ) {
              // Keep a canvas-space drop point even for source-template words,
              // which continue to use x/y offsets in the preview. ExportPanel
              // converts this snapshot to video space so the burned result is
              // WYSIWYG even when the source template reflows or scales.
              nextWordStyle.cptCanvasXPercent = absXPct
              nextWordStyle.cptCanvasYPercent = absYPct
            }
            if (!dragState.isElement && !shouldDetachWord) {
              delete nextWordStyle.abs_x_pct
              delete nextWordStyle.abs_y_pct
            }

            return {
              ...c,
              wordStyles: {
                ...wordStyles,
                [styleKey]: nextWordStyle
              }
            }
          }))

          requestAnimationFrame(() => {
            if (dragState.dragSource === 'source-template') {
              restoreInlineTranslate()
            } else if (dragState.isElement) {
              dragPreviewElement.style.setProperty(
                'transform',
                `translate(${finalCoords.x}px, ${finalCoords.y}px)`
              )
            } else {
              restoreInlineTranslate()
            }
          })
        }

        lastDragDropTime.current = Date.now()
      }

      clearCptDragMarker()
      setDraggingWord(null)
      currentDragCoordinates.current = null
      setSnapGuides({ hLines: [], vLines: [] })
      setCptWordGuides([])
    }

    const cancelWordDrag = () => {
      restoreInlineTranslate()
      if (isElement) dragPreviewElement.style.transform = initialInlineTransform
      clearCptDragMarker()
      setDraggingWord(null)
      currentDragCoordinates.current = null
      setSnapGuides({ hLines: [], vLines: [] })
      setCptWordGuides([])
    }
    startGesture({ onMove: handleNativeMouseMove, onEnd: handleNativeMouseUp, onCancel: cancelWordDrag, cursor: 'grabbing' })

  }


  return { handleWordMouseDown, handleDetachedWordResizeStart, handleDetachedWordRotateStart, handleSelectedDetachedWordDelete }
}
