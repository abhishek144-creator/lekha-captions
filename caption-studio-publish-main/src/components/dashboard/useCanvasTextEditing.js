
import { useState } from 'react'

export function useCanvasTextEditing({
  setCaptions,
  inputRef,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')

  const handleCaptionDoubleClick = (e, caption) => {
    if (!setCaptions || !caption) return
    e.stopPropagation()
    setIsEditing(caption.id)
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

  const handleEditComplete = (captionId) => {
    if (setCaptions && captionId) {
      setCaptions(prev => prev.map(cap =>
        cap.id === captionId ? { ...cap, text: editText } : cap
      ))
    }
    setIsEditing(false)
    setEditText('')
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
      setEditText('')
    }
    // Allow all keys including backspace, Enter, etc.
  }

  const handleEditInput = (e) => {
    // Save cursor position before updating state
    const selection = window.getSelection()
    if (!selection?.rangeCount) {
      setEditText((e.currentTarget.innerText || e.currentTarget.textContent || '').replace(/\u00a0/g, ' '))
      return
    }
    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(e.currentTarget)
    preCaretRange.setEnd(range.endContainer, range.endOffset)
    const caretOffset = preCaretRange.toString().length

    const newText = (e.currentTarget.innerText || e.currentTarget.textContent || '').replace(/\u00a0/g, ' ')
    setEditText(newText)

    // Restore cursor position after state update
    requestAnimationFrame(() => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        const newRange = document.createRange()
        const newSelection = window.getSelection()

        let node = inputRef.current.firstChild

        if (node && node.nodeType === Node.TEXT_NODE) {
          const offset = Math.min(caretOffset, node.textContent.length)
          newRange.setStart(node, offset)
          newRange.setEnd(node, offset)
          newSelection.removeAllRanges()
          newSelection.addRange(newRange)
        }
      }
    })
  }


  return { isEditing, setIsEditing, editText, setEditText, handleCaptionDoubleClick, handleEditComplete, handleEditKeyDown, handleEditInput }
}
