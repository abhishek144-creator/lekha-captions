// Curated template set for the mobile editor (v1).
// Style objects mirror the definitions in src/components/dashboard/TemplatesTab.jsx
// (kept as data here so the desktop file stays untouched). The visual effect comes
// from the shared CSS classes in src/styles/captionTemplates.css — same ids,
// same class contract (word / current / active / done / imp), so preview and
// export behave exactly like the desktop editor for these ids.

export const MOBILE_TEMPLATES = [
  {
    id: 't-115', name: 'Green Neon Pulse', bg: '#111',
    style: { template_id: 't-115', font_family: 'Noto Sans', font_size: 28, font_weight: '900', font_style: 'italic', position_y: 75, text_color: '#FFFFFF', secondary_color: '#39FF14', has_shadow: true, shadow_color: '#39FF14', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0 }
  },
  {
    id: 't-109', name: '3D Shadow', bg: '#1a1a1a',
    style: { template_id: 't-109', font_family: 'Noto Sans', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', secondary_color: '#E01A1A', has_shadow: true, shadow_color: '#E01A1A', shadow_offset_x: 3, shadow_offset_y: 3, shadow_blur: 0 }
  },
  {
    id: 't-26', name: 'Bold Stroke', bg: '#e8e8e8',
    style: { template_id: 't-26', font_family: 'Bangers', font_size: 28, font_weight: '900', text_case: 'uppercase', position_y: 75, text_color: '#000000', secondary_color: '#ff2058', has_background: true, background_color: '#e8e8e8', background_opacity: 1.0, has_stroke: true, stroke_color: '#000000', stroke_width: 1 }
  },
  {
    id: 't-102', name: 'Clarity', bg: '#FFFFFF',
    style: { template_id: 't-102', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75, text_color: '#1F2022', secondary_color: '#1F2022', has_background: true, background_color: '#FFFFFF', background_opacity: 1.0, background_padding: 10 }
  },
  {
    id: 't-36', name: 'Color Flash', bg: '#111',
    style: { template_id: 't-36', font_family: 'Noto Sans', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', secondary_color: '#00ffb3' }
  },
  {
    id: 't-9', name: 'Fire Words', bg: '#1a0500',
    style: { template_id: 't-9', font_family: 'Noto Sans', font_size: 26, font_weight: '900', text_case: 'uppercase', position_y: 75, text_color: '#ff8c00', secondary_color: '#ff8c00', has_shadow: true, shadow_color: '#ff4500', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0 }
  },
  {
    id: 't-12', name: 'Horror', bg: '#000',
    style: { template_id: 't-12', font_family: 'Special Elite', font_size: 22, position_y: 75, text_color: '#cc0000', secondary_color: '#cc0000', has_shadow: true, shadow_color: '#cc0000', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0 }
  },
  {
    id: 't-103', name: 'Nightfall', bg: '#1e1e1e',
    style: { template_id: 't-103', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75, text_color: '#FFFFFF', has_background: true, background_color: '#1e1e1e', background_opacity: 0.85, background_padding: 10 }
  },
  {
    id: 't-112', name: 'Pink Gradient', bg: '#111',
    style: { template_id: 't-112', font_family: 'Noto Sans', font_size: 25, font_weight: '900', position_y: 75, text_color: '#FF007F', secondary_color: '#FF8E53' }
  },
  {
    id: 't-111', name: 'Red Tape', bg: '#111',
    style: { template_id: 't-111', font_family: 'Inter', font_size: 22, font_weight: '900', position_y: 75, text_color: '#FFFFFF', secondary_color: '#E60000' }
  },
  {
    id: 't-T5', name: 'Sentence Box', bg: '#111',
    style: { template_id: 't-T5', font_family: 'Montserrat', font_size: 24, font_weight: '800', font_style: 'italic', has_background: true, background_color: '#ECF00F', background_opacity: 1.0, background_padding: 10, text_color: '#333333', position_y: 75 }
  },
  {
    id: 't-56', name: 'Underline', bg: '#111',
    style: { template_id: 't-56', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', secondary_color: '#0066FF' }
  },
  {
    id: 't-57', name: 'VHS Glitch', bg: '#111',
    style: { template_id: 't-57', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', has_shadow: true, shadow_color: '#00ffff', shadow_offset_x: 2, shadow_offset_y: 0, shadow_blur: 0 }
  },
  {
    id: 't-37', name: 'Wipe Mask', bg: '#111',
    style: { template_id: 't-37', font_family: 'Inter', font_size: 26, font_weight: '900', text_case: 'uppercase', position_y: 75, text_color: '#FF007F' }
  },
]

// Canonical export overrides for the curated ids — mirrors
// TEMPLATE_CANONICAL_STYLES in src/components/dashboard/ExportPanel.jsx so the
// mobile export burns the same bg/stroke/shadow the desktop export would.
export const MOBILE_TEMPLATE_CANONICAL_STYLES = {
  't-115': { has_shadow: true, shadow_color: '#39FF14', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0, has_background: false, has_stroke: false },
  't-109': { has_shadow: true, shadow_color: '#E01A1A', shadow_blur: 0, shadow_offset_x: 3, shadow_offset_y: 3, has_background: false, has_stroke: false },
  't-26': { has_background: true, background_color: '#e8e8e8', background_opacity: 1.0, has_stroke: true, stroke_color: '#000000', stroke_width: 1, has_shadow: false },
  't-102': { has_background: true, background_color: '#FFFFFF', background_opacity: 1.0, background_padding: 10, has_stroke: false, has_shadow: false },
  't-36': { has_background: false, has_stroke: false, has_shadow: false },
  't-9': { has_shadow: true, shadow_color: '#ff4500', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0, has_background: false, has_stroke: false },
  't-12': { has_shadow: true, shadow_color: '#cc0000', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0, has_background: false, has_stroke: false },
  't-103': { has_background: true, background_color: '#1e1e1e', background_opacity: 0.85, background_padding: 10, has_stroke: false, has_shadow: false },
  't-112': { has_background: false, has_stroke: false, has_shadow: false },
  't-111': { has_background: false, has_stroke: false, has_shadow: false },
  't-T5': { has_background: true, background_color: '#ECF00F', background_opacity: 1.0, background_padding: 10, has_stroke: false, has_shadow: false },
  't-56': { has_background: false, has_stroke: false, has_shadow: false },
  't-57': { has_shadow: true, shadow_color: '#00ffff', shadow_blur: 0, shadow_offset_x: 2, shadow_offset_y: 0, has_background: false, has_stroke: false },
  't-37': { has_background: false, has_stroke: false, has_shadow: false },
}

// Hindi placeholder words for the template preview cards (primary audience
// captions in Devanagari — Latin placeholders hide font fallbacks)
export const MOBILE_PREVIEW_WORDS = [
  { text: 'यह', important: false },
  { text: 'है', important: true },
  { text: 'शानदार', important: false },
  { text: 'अब', important: false },
]
