import { useCallback, useEffect, useRef, useState } from 'react'

const HISTORY_LIMIT = 50
// Rapid consecutive coalesced pushes (per-keystroke text edits) record one
// snapshot per burst.
const COALESCE_WINDOW_MS = 1200

const snapshotOf = (captions, captionStyle) => ({
  captions: JSON.parse(JSON.stringify(captions)),
  captionStyle: JSON.parse(JSON.stringify(captionStyle)),
})

// Undo/redo for captions and caption style. `history` holds PRE-change
// snapshots (history[historyIndex] is what undo restores). Undone states live
// on `redoStack`; without it, redo re-restored the snapshot the editor was
// already showing and the newest state was unreachable.
export function useEditorHistory({ captions, captionStyle, setCaptions, setCaptionStyle }) {
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [redoStack, setRedoStack] = useState([])
  const lastCoalescedPushRef = useRef(0)

  // Records the current state, then applies the new captions and/or style.
  // options.coalesce: without it, typing a sentence pushed ~50 single-character
  // entries and flushed the entire useful undo history.
  const pushHistory = (newCaptions, newStyle, options = {}) => {
    const now = Date.now()
    const coalesce = options.coalesce === true
    const withinBurst = coalesce && (now - lastCoalescedPushRef.current < COALESCE_WINDOW_MS)
    lastCoalescedPushRef.current = coalesce ? now : 0
    if (!withinBurst) {
      const newHistory = [...history.slice(0, historyIndex + 1), snapshotOf(captions, captionStyle)]
      if (newHistory.length > HISTORY_LIMIT) newHistory.shift()
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    }
    // Any new change invalidates the redo branch.
    setRedoStack([])
    if (newCaptions !== undefined) setCaptions(newCaptions)
    if (newStyle !== undefined) setCaptionStyle(newStyle)
  }

  const undo = () => {
    if (historyIndex < 0) return
    const prevState = history[historyIndex]
    // Save the state being undone so redo can bring it back: history only
    // holds pre-change snapshots, never the state after a change.
    setRedoStack((stack) => [...stack, snapshotOf(captions, captionStyle)])
    setCaptions(prevState.captions)
    setCaptionStyle(prevState.captionStyle)
    setHistoryIndex(historyIndex - 1)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const nextState = redoStack[redoStack.length - 1]
    setRedoStack((stack) => stack.slice(0, -1))
    // The state being replaced becomes the pre-change snapshot again.
    setHistory((entries) => [...entries.slice(0, historyIndex + 1), snapshotOf(captions, captionStyle)])
    setHistoryIndex(historyIndex + 1)
    setCaptions(nextState.captions)
    setCaptionStyle(nextState.captionStyle)
  }

  const resetHistory = useCallback(() => {
    setHistory([])
    setHistoryIndex(-1)
    setRedoStack([])
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
    canUndo: historyIndex >= 0,
    canRedo: redoStack.length > 0,
  }
}
