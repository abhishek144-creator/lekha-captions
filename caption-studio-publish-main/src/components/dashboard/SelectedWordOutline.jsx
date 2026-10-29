import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Highlighter, Move, RotateCcw, RotateCw } from 'lucide-react'
import { useDocumentGesture } from './useDocumentGesture'
import { getPreviewOverlayRoot, PREVIEW_WORD_BOX_Z_INDEX } from './previewOverlayRoot'
import { wordHasBackground } from '@/lib/wordStyleEdits'

// Selection box for a word that stays inside its caption or template (one not
// dragged out to a free position; those get the editor box in VideoPlayer).
// A template word keeps its own markup and motion, so the box follows the
// word's on-screen visual and edits it through the word's style: corner dots
// set its size, the rotate and move buttons turn and drag it, and reset clears
// every edit. A plain caption word gets the frame and the background button.
// The frame itself lets pointer events through to the word.

const isShown = (node) => getComputedStyle(node).visibility !== 'hidden'

// A dragged template word keeps its slot (the [data-word-key] box) and draws
// its visual in a child moved with CSS `translate`; frame that child.
const getWordVisual = (node) => [...node.querySelectorAll('*')].find((child) => {
  const shift = child.style.translate
  return shift && shift !== 'none' && isShown(child)
}) || node

// Templates also render hidden measuring copies of their words; only a
// visible copy is framed (the largest, which is the word's outer box).
const findVisibleWord = (container, wordKey) => {
  if (!container || !wordKey) return null
  let best = null
  container.querySelectorAll(`[data-word-key="${CSS.escape(wordKey)}"]`).forEach((node) => {
    if (node.closest('[aria-hidden="true"]') || !isShown(node)) return
    const visual = getWordVisual(node)
    const rect = visual.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    if (!best || rect.width * rect.height > best.rect.width * best.rect.height) best = { node, visual, rect }
  })
  return best
}

// Centre from the on-screen box; size from the unrotated layout box (scaled
// like the canvas) so a rotated word keeps a tight, rotated frame.
const measureWord = (container, wordKey, rotation) => {
  const found = findVisibleWord(container, wordKey)
  if (!found) return null
  const { rect, visual, node } = found
  const containerScale = container.offsetWidth ? container.getBoundingClientRect().width / container.offsetWidth : 1
  const layoutWidth = visual.offsetWidth * containerScale
  const layoutHeight = visual.offsetHeight * containerScale
  const useLayoutBox = rotation && layoutWidth > 0 && layoutHeight > 0
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    width: useLayoutBox ? layoutWidth : rect.width,
    height: useLayoutBox ? layoutHeight : rect.height,
    isTemplateWord: node.dataset.sourceWordIndex !== undefined,
  }
}

const sameBox = (a, b) => Boolean(a && b)
  && a.isTemplateWord === b.isTemplateWord
  && ['x', 'y', 'width', 'height'].every((key) => Math.abs(a[key] - b[key]) < 0.5)

const CORNERS = [
  { classes: '-top-3 -left-3 cursor-nwse-resize', sideX: 'left', sideY: 'top' },
  { classes: '-top-3 -right-3 cursor-nesw-resize', sideX: 'right', sideY: 'top' },
  { classes: '-bottom-3 -left-3 cursor-nesw-resize', sideX: 'left', sideY: 'bottom' },
  { classes: '-bottom-3 -right-3 cursor-nwse-resize', sideX: 'right', sideY: 'bottom' },
]

const ACTION_BUTTON = 'flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105'
const ACTION_BUTTON_ON = 'flex h-6 w-6 items-center justify-center rounded-full border border-[#8b5cf6] bg-[#ede9fe] text-[#6d28d9] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105'

// Background on/off for the selected word, in the action row under it (the
// word popup's Style tab has the same switch plus colour and opacity).
export function WordBackgroundButton({ active, onToggle }) {
  const stop = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }
  return (
    <button
      type="button"
      className={active ? ACTION_BUTTON_ON : ACTION_BUTTON}
      onPointerDown={stop}
      onClick={(event) => {
        stop(event)
        onToggle()
      }}
      title={active ? 'Remove word background' : 'Add word background'}
      aria-label="Word background"
      aria-pressed={Boolean(active)}
      data-word-background-toggle="true"
      data-video-control
    >
      <Highlighter className="h-3 w-3" strokeWidth={1.9} />
    </button>
  )
}

export default function SelectedWordOutline({
  containerRef,
  wordKey = '',
  wordStyle = {},
  renderScale = 1,
  onGestureStart,
  onWordStyleChange,
  onMoveStart,
  onReset,
  onToggleBackground,
}) {
  const [box, setBox] = useState(null)
  const startGesture = useDocumentGesture()
  const rotation = Number(wordStyle.rotation) || 0

  useEffect(() => {
    if (!wordKey) {
      setBox(null)
      return undefined
    }
    // Template words animate and can be dragged, so the box follows them
    // every frame while the word stays selected.
    let frame = 0
    const measure = () => {
      const next = measureWord(containerRef.current, wordKey, rotation)
      setBox((prev) => (sameBox(prev, next) ? prev : next))
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [containerRef, wordKey, rotation])

  if (!wordKey || !box || typeof document === 'undefined') return null
  const editable = box.isTemplateWord && onWordStyleChange

  const stop = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  // Corner dots scale the word's font size from the dot's drag distance.
  const startResize = (event, corner) => {
    stop(event)
    const found = findVisibleWord(containerRef.current, wordKey)
    if (!found) return
    const startRect = found.visual.getBoundingClientRect()
    const startMeasure = Math.max(startRect.width, startRect.height, 1)
    const initialFontSize = Number(wordStyle.fontSize)
      || parseFloat(getComputedStyle(found.visual).fontSize) / Math.max(renderScale, 0.001)
      || 24
    onGestureStart?.()
    startGesture({
      cursor: 'nwse-resize',
      onMove: (moveEvent) => {
        moveEvent.preventDefault()
        const deltaX = (moveEvent.clientX - event.clientX) * (corner.sideX === 'left' ? -1 : 1)
        const deltaY = (moveEvent.clientY - event.clientY) * (corner.sideY === 'top' ? -1 : 1)
        const dominantDelta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY
        const scale = Math.max(0.35, Math.min(5, (startMeasure + dominantDelta) / startMeasure))
        const fontSize = Math.max(8, Math.min(140, Math.round(initialFontSize * scale)))
        onWordStyleChange((style) => {
          const next = { ...style, fontSize }
          delete next.frozenFontSize
          return next
        })
      },
    })
  }

  const startRotate = (event) => {
    stop(event)
    onGestureStart?.()
    startGesture({
      cursor: 'grabbing',
      onMove: (moveEvent) => {
        moveEvent.preventDefault()
        const delta = (moveEvent.clientX - event.clientX) + (moveEvent.clientY - event.clientY)
        const next = Math.round(rotation + delta * 0.55)
        onWordStyleChange((style) => ({ ...style, rotation: next }))
      },
    })
  }

  const startMove = (event) => {
    const found = findVisibleWord(containerRef.current, wordKey)
    if (found) onMoveStart?.(event, found.node)
  }

  const pad = 3
  return createPortal(
    <span
      data-selected-word-outline="true"
      data-selected-template-word={editable ? 'true' : undefined}
      className="pointer-events-none fixed rounded-[1px] border border-[#9f83ff] shadow-[0_0_0_1px_rgba(255,255,255,0.16)]"
      style={{
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width + pad * 2}px`,
        height: `${box.height + pad * 2}px`,
        transform: `translate(-50%, -50%)${rotation ? ` rotate(${rotation}deg)` : ''}`,
        zIndex: PREVIEW_WORD_BOX_Z_INDEX,
      }}
      data-video-control
    >
      {editable && (
        <>
          {CORNERS.map((corner) => (
            <span
              key={corner.classes}
              onPointerDown={(event) => startResize(event, corner)}
              onDragStart={(event) => event.preventDefault()}
              className={`word-resize-handle pointer-events-auto absolute flex h-6 w-6 items-center justify-center rounded-full ${corner.classes}`}
              title="Resize word"
              data-resize-axis="corner"
              data-resize-side={corner.sideX}
              data-resize-vertical-side={corner.sideY}
              data-video-control
            >
              <span className="block h-2 w-2 rounded-full border border-[#a78bfa] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)]" />
            </span>
          ))}
        </>
      )}
      {(editable || onToggleBackground) && (
        <span
          className="pointer-events-auto absolute left-1/2 top-full mt-[14px] flex -translate-x-1/2 items-center gap-2"
          data-selected-word-actions="true"
        >
          {onToggleBackground && (
            <WordBackgroundButton active={wordHasBackground(wordStyle)} onToggle={onToggleBackground} />
          )}
          {editable && (
            <>
              <span className={ACTION_BUTTON} style={{ cursor: 'grab' }} onPointerDown={startRotate} title="Rotate word" data-video-control>
                <RotateCw className="h-3 w-3" strokeWidth={1.9} />
              </span>
              <span className={ACTION_BUTTON} style={{ cursor: 'move' }} onPointerDown={startMove} title="Move word" data-video-control>
                <Move className="h-3 w-3" strokeWidth={1.9} />
              </span>
              {/* In the action row: a corner dot would sit on top of it. */}
              {onReset && (
                <button
                  type="button"
                  className={ACTION_BUTTON}
                  onPointerDown={stop}
                  onClick={(event) => {
                    stop(event)
                    onReset()
                  }}
                  title="Reset word (position, size, colour and effects)"
                  aria-label="Reset word"
                  data-video-control
                >
                  <RotateCcw className="h-3 w-3" strokeWidth={1.9} />
                </button>
              )}
            </>
          )}
        </span>
      )}
    </span>,
    getPreviewOverlayRoot(),
  )
}
