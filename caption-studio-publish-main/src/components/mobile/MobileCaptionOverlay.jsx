import React from 'react'
import '../../styles/captionTemplates.css'

// Renders the currently-active caption over the mobile video stage.
//
// Two paths, mirroring how the desktop VideoPlayer treats t-* CSS templates:
//  - template path: container carries the template id class + the
//    --template-* CSS variables; words get word/current/active/done/imp
//    classes so captionTemplates.css drives the visual effect
//  - custom path: inline styles built from captionStyle (color, shadow,
//    stroke, background, gradient), current word tinted with highlight_color
//
// Every word span carries data-word-key="<captionId>-<index>" so the export
// flow can capture DOM word layouts exactly like the desktop ExportPanel does.

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '#000000').replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padEnd(6, '0')
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Same proportional fallback the desktop preview uses, upgraded to real word
// timings when the transcript provides them
export const getActiveWordIndex = (caption, currentTime) => {
  const words = (caption?.text || '').split(' ').filter(Boolean)
  const wordCount = words.length
  if (wordCount <= 1) return 0

  const timedWords = caption?.words || []
  if (timedWords.length === wordCount && timedWords.every(w => Number.isFinite(w?.start))) {
    for (let i = wordCount - 1; i >= 0; i--) {
      if (currentTime >= (timedWords[i].start ?? 0)) return i
    }
    return 0
  }

  const start = caption.start_time ?? 0
  const duration = (caption.end_time ?? start) - start
  if (duration <= 0) return 0
  const progressed = Math.floor(((currentTime - start) / duration) * wordCount)
  return Math.max(0, Math.min(wordCount - 1, progressed))
}

export default function MobileCaptionOverlay({ caption, captionStyle, currentTime }) {
  if (!caption || !caption.text) return null

  const style = captionStyle || {}
  const words = caption.text.split(' ').filter(Boolean)
  const currentIdx = getActiveWordIndex(caption, currentTime)
  const templateId = style.template_id || ''
  const positionY = Number.isFinite(style.position_y) ? style.position_y : 75

  const baseTextStyle = {
    fontFamily: style.font_family || 'Inter',
    fontSize: `${style.font_size || 18}px`,
    lineHeight: style.line_spacing || 1.4,
    fontWeight: style.font_weight || '700',
    fontStyle: style.font_style || 'normal',
    textAlign: style.text_align || 'center',
    letterSpacing: style.letter_spacing ? `${style.letter_spacing}px` : undefined,
    textTransform: style.text_case && style.text_case !== 'none' ? style.text_case : undefined,
  }

  const renderTemplateWords = () => words.map((word, wordIndex) => {
    const wordStyle = caption.wordStyles?.[`${caption.id}-${wordIndex}`] || {}
    let cls = 'word'
    if (wordIndex === currentIdx) cls += ' current active'
    else if (wordIndex < currentIdx) cls += ' active done'
    if (wordStyle.isEmphasis) cls += ' imp'
    return (
      <span
        key={wordIndex}
        data-word-key={`${caption.id}-${wordIndex}`}
        className={cls}
        style={{ display: 'inline-block', marginRight: wordIndex < words.length - 1 ? `${(style.word_spacing ?? 1) * 2}px` : 0 }}
      >
        {word}
      </span>
    )
  })

  const renderCustomWords = () => words.map((word, wordIndex) => {
    const isCurrent = wordIndex === currentIdx
    const highlight = style.highlight_color
    return (
      <span
        key={wordIndex}
        data-word-key={`${caption.id}-${wordIndex}`}
        style={{
          display: 'inline-block',
          marginRight: wordIndex < words.length - 1 ? `${(style.word_spacing ?? 1) * 2}px` : 0,
          color: isCurrent && highlight ? highlight : undefined,
        }}
      >
        {word}
      </span>
    )
  })

  const customTextStyle = {
    ...baseTextStyle,
    opacity: style.text_opacity ?? 1,
    ...(style.text_gradient
      ? {
        backgroundImage: style.text_gradient,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
      }
      : { color: style.text_color || '#ffffff' }),
    ...(style.has_shadow
      ? { textShadow: `${style.shadow_offset_x ?? 0}px ${style.shadow_offset_y ?? 2}px ${style.shadow_blur ?? 4}px ${style.shadow_color || '#000000'}` }
      : null),
    ...(style.has_stroke
      ? { WebkitTextStroke: `${style.stroke_width || 1}px ${style.stroke_color || '#000000'}` }
      : null),
    ...(style.has_background
      ? {
        backgroundColor: hexToRgba(style.background_color || '#000000', style.background_opacity ?? 0.7),
        padding: `${Math.max(2, Math.round((style.background_padding ?? 6) * 0.55))}px 8px`,
        borderRadius: '6px',
      }
      : null),
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-3"
      style={{ top: `${positionY}%`, transform: 'translateY(-50%)' }}
    >
      {templateId ? (
        <div
          className={templateId}
          style={{
            textAlign: style.text_align || 'center',
            maxWidth: '94%',
            '--template-primary': style.text_color || '#ffffff',
            '--template-secondary': style.secondary_color || '#000000',
            '--template-bg': style.background_color || 'transparent',
            '--template-highlight': style.highlight_color || '#FFE600',
          }}
        >
          <span className="cap-text" style={{ ...baseTextStyle, display: 'inline-block' }}>
            {renderTemplateWords()}
          </span>
        </div>
      ) : (
        <span className="cap-text" style={{ ...customTextStyle, display: 'inline-block', maxWidth: '94%' }}>
          {renderCustomWords()}
        </span>
      )}
    </div>
  )
}
