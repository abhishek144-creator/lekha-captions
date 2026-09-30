import { useCallback, useEffect, useRef, useState } from 'react'

const HISTORY_LIMIT = 50
// Rapid consecutive coalesced pushes (per-keystroke text edits) within this
// window record ONE snapshot, so typing a sentence doesn't flush the history.
const COALESCE_WINDOW_MS = 1200

const cloneState = (captions, captionStyle) => ({
  captions: JSON.parse(JSON.stringify(captions)),
  captionStyle: JSON.parse(JSON.stringify(captionStyle)),
})

// Undo/redo for the editor's captions + caption style.
// `history` holds PRE-change snapshots (history[historyIndex] is what undo
// restores); undone states live on `redoStack` so redo can bring them back.
export function useEditorHistory({ captions, captionStyle, setCaptions, setCaptionStyle }) {
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [redoStack, setRedoStack] = useState([])
  const lastCoalescedPushRef = useRef(0)

  // Push the current state to history, then apply the new state.
  const pushHistory = (newCaptions, newStyle, options = {}) => {
    const now = Date.now()
    const coalesce = options.coalesce === true
    const withinBurst = coalesce && (now - lastCoalescedPushRef.current < COALESCE_WINDOW_MS)
    lastCoalescedPushRef.current = coalesce ? now : 0
    if (!withinBurst) {
      const newHistory = [...history.slice(0, historyIndex + 1), cloneState(captions, captionStyle)]
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
    // Save the state being undone so redo can bring it back.
    setRedoStack(stack => [...stack, cloneState(captions, captionStyle)])
    setCaptions(prevState.captions)
    setCaptionStyle(prevState.captionStyle)
    setHistoryIndex(historyIndex - 1)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const nextState = redoStack[redoStack.length - 1]
    setRedoStack(stack => stack.slice(0, -1))
    // The state being replaced becomes the pre-change snapshot again.
    setHistory(h => [...h.slice(0, historyIndex + 1), cloneState(captions, captionStyle)])
    setHistoryIndex(historyIndex + 1)
    setCaptions(nextState.captions)
    setCaptionStyle(nextState.captionStyle)
  }

  // Forget everything: a new project, upload, reset or account must never be
  // able to undo/redo back into the previous one.
  const resetHistory = useCallback(() => {
    setHistory([])
    setHistoryIndex(-1)
    setRedoStack([])
    lastCoalescedPushRef.current = 0
  }, [])

  // Global shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redo.
  useEffect(() => {
    const onKeyDown = (e) => {
      const active = document.activeElement
      const tag = active?.tagName
      // Don't intercept while the user is typing in a field.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (e.shiftKey && key === 'z'))) { e.preventDefault(); redo() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  return {
    pushHistory,
    undo,
    redo,
    resetHistory,
    canUndo: historyIndex >= 0,
    canRedo: redoStack.length > 0,
  }
}
