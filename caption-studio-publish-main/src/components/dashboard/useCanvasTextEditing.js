
import { useRef, useState } from 'react'
import { reconcileCaptionText } from './captionEditingUtils'

const readEditableText = (node) => (
  (node?.innerText ?? node?.textContent ?? '').replace(/ /g, ' ')
)

// A text change made on the canvas keeps word timings, word styles and
// emphasis on the words they belong to, exactly like an edit in the caption
// list. Text elements have no measured words, so only their styles move.
export const applyCanvasTextEdit = (caption, text) => {
  const reconciled = reconcileCaptionText(caption, text)
  if (!caption?.isTextElement) return reconciled
  return {
    ...reconciled,
    words: caption.words,
    word_alignment_status: caption.word_alignment_status,
    word_alignment_note: caption.word_alignment_note,
  }
}

export function useCanvasTextEditing({
  setCaptions,
  inputRef,
}) {
  const [isEditing, setIsEditing] = useState(false)
  // The editable box is uncontrolled: React renders the starting text once
  // and the browser owns it while typing. Re-rendering typed text into a
  // contentEditable moved the caret and misplaced characters.
  const [editInitialText, setEditInitialText] = useState('')
  const [editText, setEditText] = useState('')
  const originalTextRef = useRef('')
  const cancelledRef = useRef(false)

  const handleCaptionDoubleClick = (e, caption) => {
    if (!setCaptions || !caption) return
    e.stopPropagation()
    cancelledRef.current = false
    originalTextRef.current = caption.text || ''
    setIsEditing(caption.id)
    setEditInitialText(caption.text || '')
    setEditText(caption.text || '')
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        // Place cursor at the end instead of selecting all
        const range = document.createRange()
        range.selectNodeContents(inputRef.current)
        range.collapse(false)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }, 0)
  }

  const finishEditing = () => {
    setIsEditing(false)
    setEditText('')
    setEditInitialText('')
  }

  const handleEditComplete = (captionId) => {
    const text = inputRef.current ? readEditableText(inputRef.current) : editText
    // Escape cancels; an unchanged text records nothing (no undo step).
    if (!cancelledRef.current && setCaptions && captionId && text !== originalTextRef.current) {
      setCaptions(prev => prev.map(cap => (
        cap.id === captionId ? applyCanvasTextEdit(cap, text) : cap
      )))
    }
    cancelledRef.current = false
    finishEditing()
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') {
      cancelledRef.current = true
      finishEditing()
    }
    // Allow all keys including backspace, Enter, etc.
  }

  const handleEditInput = (e) => {
    setEditText(readEditableText(e.currentTarget))
  }

  return { isEditing, setIsEditing, editText, editInitialText, setEditText, handleCaptionDoubleClick, handleEditComplete, handleEditKeyDown, handleEditInput }
}
