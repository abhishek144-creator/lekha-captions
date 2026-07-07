import React from 'react'
import MobileBottomSheet from './MobileBottomSheet'
import { getFontOptionsForScript, loadGoogleFont } from '@/components/dashboard/fontUtils'

const TEXT_COLORS = ['#FFFFFF', '#FFE600', '#39FF14', '#FF007F', '#00CFFF', '#FF8C00', '#E01A1A', '#000000']
const HIGHLIGHT_COLORS = ['', '#FFE600', '#39FF14', '#FF007F', '#00CFFF', '#F5A623', '#E01A1A']

const SectionLabel = ({ children }) => (
  <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 first:mt-0">{children}</p>
)

const ColorRow = ({ colors, value, onSelect, allowNone = false }) => (
  <div className="flex flex-wrap gap-2">
    {colors.map((color) => {
      const isNone = color === ''
      const selected = (value || '') === color
      return (
        <button
          key={color || 'none'}
          type="button"
          onClick={() => onSelect(color)}
          className={`h-10 w-10 rounded-full border-2 transition-transform active:scale-90 ${selected ? 'border-[#F5A623]' : 'border-white/15'}`}
          style={isNone
            ? { background: 'linear-gradient(135deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)', backgroundColor: '#1a1a1a' }
            : { backgroundColor: color }}
          aria-label={isNone ? 'No highlight' : `Color ${color}`}
        />
      )
    })}
    {!allowNone && null}
  </div>
)

// Touch-first basic style controls: font, size, colors, background, position.
// Writes through the same captionStyle object the desktop editor uses, so the
// export payload stays identical in shape.
export default function MobileStyleSheet({ open, onClose, captionStyle, updateStyle }) {
  const script = captionStyle?.detected_script || 'latin'
  const fontOptions = getFontOptionsForScript(script).slice(0, 12)

  const handleFontSelect = (font) => {
    updateStyle({ font_family: font.name })
    loadGoogleFont(font.name, font.weights || [400, 700]).catch(() => {})
  }

  return (
    <MobileBottomSheet open={open} onClose={onClose} title="Style" height="60dvh">
      <SectionLabel>Font</SectionLabel>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {fontOptions.map((font) => (
          <button
            key={font.name}
            type="button"
            onClick={() => handleFontSelect(font)}
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm transition-colors ${captionStyle?.font_family === font.name
              ? 'border-[#F5A623] bg-[#F5A623]/10 text-white'
              : 'border-white/10 bg-white/[0.03] text-gray-300 active:bg-white/10'}`}
            style={{ fontFamily: font.name }}
          >
            {font.name}
          </button>
        ))}
      </div>

      <SectionLabel>Size — {captionStyle?.font_size || 18}px</SectionLabel>
      <input
        type="range"
        min={12}
        max={48}
        step={1}
        value={captionStyle?.font_size || 18}
        onChange={(e) => updateStyle({ font_size: parseInt(e.target.value, 10) })}
        className="h-11 w-full accent-[#F5A623]"
        aria-label="Font size"
      />

      <SectionLabel>Text color</SectionLabel>
      <ColorRow
        colors={TEXT_COLORS}
        value={captionStyle?.text_color || '#FFFFFF'}
        onSelect={(color) => updateStyle({ text_color: color })}
      />

      <SectionLabel>Spoken-word highlight</SectionLabel>
      <ColorRow
        colors={HIGHLIGHT_COLORS}
        value={captionStyle?.highlight_color || ''}
        onSelect={(color) => updateStyle({ highlight_color: color })}
        allowNone
      />

      <SectionLabel>Background</SectionLabel>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={!!captionStyle?.has_background}
          onClick={() => updateStyle({ has_background: !captionStyle?.has_background })}
          className={`relative h-7 w-12 rounded-full transition-colors ${captionStyle?.has_background ? 'bg-[#F5A623]' : 'bg-white/15'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${captionStyle?.has_background ? 'left-6' : 'left-1'}`} />
        </button>
        <span className="text-sm text-gray-300">{captionStyle?.has_background ? 'On' : 'Off'}</span>
        {captionStyle?.has_background && (
          <input
            type="color"
            value={captionStyle?.background_color || '#000000'}
            onChange={(e) => updateStyle({ background_color: e.target.value })}
            className="h-10 w-14 cursor-pointer rounded-lg border border-white/15 bg-transparent"
            aria-label="Background color"
          />
        )}
      </div>

      <SectionLabel>Position — {captionStyle?.position_y ?? 75}%</SectionLabel>
      <input
        type="range"
        min={10}
        max={90}
        step={1}
        value={captionStyle?.position_y ?? 75}
        onChange={(e) => updateStyle({ position_y: parseInt(e.target.value, 10) })}
        className="h-11 w-full accent-[#F5A623]"
        aria-label="Vertical position"
      />
      <p className="pb-2 text-[11px] text-gray-500">Slide left to move captions up, right to move them down.</p>
    </MobileBottomSheet>
  )
}
