import React, { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import MobileBottomSheet from './MobileBottomSheet'
import { MOBILE_TEMPLATES, MOBILE_PREVIEW_WORDS } from './mobileTemplates'
import '../../styles/captionTemplates.css'

// Curated template picker as a bottom sheet. Preview cards animate through
// the word states exactly like the desktop TemplatesTab cards (same CSS).
export default function MobileTemplateSheet({ open, onClose, currentStyle, onApplyTemplate }) {
  const [previewIndex, setPreviewIndex] = useState(0)

  useEffect(() => {
    if (!open) return undefined
    const intervalId = window.setInterval(() => {
      setPreviewIndex(current => (current + 1) % MOBILE_PREVIEW_WORDS.length)
    }, 700)
    return () => window.clearInterval(intervalId)
  }, [open])

  const getPreviewWordClass = (word, index) => {
    if (index < previewIndex) return `word active${word.important ? ' imp' : ''}`
    if (index === previewIndex) return `word current${word.important ? ' imp' : ''}`
    return `word${word.important ? ' imp' : ''}`
  }

  const handleClear = () => {
    onApplyTemplate({ template_id: '' })
    onClose()
  }

  return (
    <MobileBottomSheet open={open} onClose={onClose} title="Templates" height="60dvh">
      <button
        type="button"
        onClick={handleClear}
        className={`mb-3 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${!currentStyle?.template_id
          ? 'border-white/30 bg-white/10'
          : 'border-white/10 bg-white/[0.03] active:bg-white/10'}`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <X className="h-4 w-4 text-gray-300" />
        </span>
        <span>
          <span className="block text-sm font-medium text-white">
            None (Default)
            {!currentStyle?.template_id && <Check className="ml-1.5 inline h-3.5 w-3.5" />}
          </span>
          <span className="block text-[11px] text-gray-500">Remove template, keep custom style</span>
        </span>
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        {MOBILE_TEMPLATES.map((template) => {
          const isActive = currentStyle?.template_id === template.id
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => { onApplyTemplate(template.style); onClose() }}
              className={`overflow-hidden rounded-2xl border text-left transition-colors ${isActive
                ? 'border-[#F5A623] bg-[#F5A623]/10'
                : 'border-white/10 bg-white/[0.02] active:bg-white/10'}`}
            >
              <div
                className={template.id}
                style={{
                  backgroundColor: template.bg,
                  padding: '14px 8px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '58px',
                  '--template-primary': template.style?.text_color || '#fff',
                  '--template-secondary': template.style?.secondary_color || '#000',
                  '--template-bg': template.style?.background_color || 'transparent',
                  '--template-highlight': template.style?.highlight_color || '#FFE600',
                }}
              >
                <span className="cap-text" style={{ display: 'inline-flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '13px' }}>
                  {MOBILE_PREVIEW_WORDS.map((w, i) => (
                    <span key={`${template.id}-${previewIndex}-${i}`} className={getPreviewWordClass(w, i)}>{w.text}</span>
                  ))}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="truncate text-xs font-medium text-white">{template.name}</span>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-[#F5A623]" />}
              </div>
            </button>
          )
        })}
      </div>
    </MobileBottomSheet>
  )
}
