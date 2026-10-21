import { useCallback, useEffect, useRef, useState } from 'react'
import { compactDraftForStorage, expandStoredDraft } from '@/lib/editorDocument'

const HISTORY_LIMIT = 50
// Rapid consecutive coalesced pushes (per-keystroke text edits) record one
// snapshot per burst.
const COALESCE_WINDOW_MS = 1200

// Snapshots use the compact storage form: the template markup shared by every
// caption is kept once per snapshot instead of once per caption, which was
// several MB across 50 steps for a templated project.
const snapshotOf = (captions, captionStyle) => JSON.parse(JSON.stringify(
  compactDraftForStorage({ captions, captionStyle }),
))
const restoreSnapshot = (snapshot) => expandStoredDraft(JSON.parse(JSON.stringify(snapshot)))

// Undo/redo for captions and caption style. `history` holds PRE-change
// snapshots (history[historyIndex] is what undo restores). Undone states live
// on the redo stack; without it, redo re-restored the snapshot the editor was
// already showing and the newest state was unreachable.
//
// The stacks live in refs and the returned functions are stable, so panels
// that receive them can skip re-rendering on every playback tick.
export function useEditorHistory({ captions, captionStyle, setCaptions, setCaptionStyle }) {
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)
  const redoStackRef = useRef([])
  const [, setVersion] = useState(0)
  const changed = () => setVersion((version) => version + 1)
  const lastCoalescedPushRef = useRef(0)
  const latestRef = useRef({ captions, captionStyle })
  latestRef.current = { captions, captionStyle }

  // Records the current state, then applies the new captions and/or style.
  // options.coalesce: without it, typing a sentence pushed ~50 single-character
  // entries and flushed the entire useful undo history.
  const pushHistory = useCallback((newCaptions, newStyle, options = {}) => {
    const now = Date.now()
    const coalesce = options.coalesce === true
    const withinBurst = coalesce && (now - lastCoalescedPushRef.current < COALESCE_WINDOW_MS)
    lastCoalescedPushRef.current = coalesce ? now : 0
    if (!withinBurst) {
      const { captions: currentCaptions, captionStyle: currentStyle } = latestRef.current
      const newHistory = [...historyRef.current.slice(0, historyIndexRef.current + 1), snapshotOf(currentCaptions, currentStyle)]
      if (newHistory.length > HISTORY_LIMIT) newHistory.shift()
      historyRef.current = newHistory
      historyIndexRef.current = newHistory.length - 1
    }
    // Any new change invalidates the redo branch.
    redoStackRef.current = []
    changed()
    if (newCaptions !== undefined) setCaptions(newCaptions)
    if (newStyle !== undefined) setCaptionStyle(newStyle)
  }, [setCaptions, setCaptionStyle])

  const undo = useCallback(() => {
    const index = historyIndexRef.current
    if (index < 0) return
    const previous = restoreSnapshot(historyRef.current[index])
    const { captions: currentCaptions, captionStyle: currentStyle } = latestRef.current
    // Save the state being undone so redo can bring it back: history only
    // holds pre-change snapshots, never the state after a change.
    redoStackRef.current = [...redoStackRef.current, snapshotOf(currentCaptions, currentStyle)]
    historyIndexRef.current = index - 1
    lastCoalescedPushRef.current = 0
    changed()
    setCaptions(previous.captions)
    setCaptionStyle(previous.captionStyle)
  }, [setCaptions, setCaptionStyle])

  const redo = useCallback(() => {
    const stack = redoStackRef.current
    if (stack.length === 0) return
    const next = restoreSnapshot(stack[stack.length - 1])
    const { captions: currentCaptions, captionStyle: currentStyle } = latestRef.current
    redoStackRef.current = stack.slice(0, -1)
    // The state being replaced becomes the pre-change snapshot again.
    historyRef.current = [...historyRef.current.slice(0, historyIndexRef.current + 1), snapshotOf(currentCaptions, currentStyle)]
    historyIndexRef.current += 1
    lastCoalescedPushRef.current = 0
    changed()
    setCaptions(next.captions)
    setCaptionStyle(next.captionStyle)
  }, [setCaptions, setCaptionStyle])

  const resetHistory = useCallback(() => {
    historyRef.current = []
    historyIndexRef.current = -1
    redoStackRef.current = []
    changed()
  }, [])

  // Ctrl/Cmd+Z undoes; Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes. Typing in a
  // field keeps the browser's own text undo.
  const shortcutsRef = useRef({ undo, redo })
  shortcutsRef.current = { undo, redo }
  useEffect(() => {
    const onKeyDown = (event) => {
      const active = document.activeElement
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) return
      const key = event.key.toLowerCase()
      if (!(event.ctrlKey || event.metaKey)) return
      if (!event.shiftKey && key === 'z') {
        event.preventDefault()
        shortcutsRef.current.undo()
      }
      if (key === 'y' || (event.shiftKey && key === 'z')) {
        event.preventDefault()
        shortcutsRef.current.redo()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return {
    pushHistory,
    undo,
    redo,
    resetHistory,
    canUndo: historyIndexRef.current >= 0,
    canRedo: redoStackRef.current.length > 0,
  }
}
