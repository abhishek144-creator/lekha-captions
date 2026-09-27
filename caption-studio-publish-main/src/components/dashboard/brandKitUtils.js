export const BRAND_KIT_DOCUMENT_SCHEMA = 'lekha.brand-kits'
export const BRAND_KIT_DOCUMENT_VERSION = 1
export const MAX_BRAND_KITS = 8

export const BRAND_KIT_STYLE_FIELDS = [
  'font_family',
  'font_size',
  'font_weight',
  'font_style',
  'line_spacing',
  'word_spacing',
  'letter_spacing',
  'text_align',
  'text_case',
  'text_color',
  'text_gradient',
  'text_opacity',
  'highlight_color',
  'highlight_gradient',
  'secondary_color',
  'has_background',
  'background_color',
  'background_opacity',
  'background_padding',
  'background_h_multiplier',
  'has_stroke',
  'stroke_width',
  'stroke_color',
  'has_shadow',
  'shadow_color',
  'shadow_blur',
  'shadow_offset_x',
  'shadow_offset_y',
  'position_x',
  'position_y',
]

export function extractBrandKitStyle(style = {}) {
  return BRAND_KIT_STYLE_FIELDS.reduce((kitStyle, field) => {
    const value = style?.[field]
    if (value === undefined || value === null) return kitStyle
    if (!['string', 'number', 'boolean'].includes(typeof value)) return kitStyle
    kitStyle[field] = value
    return kitStyle
  }, {})
}

function normalizeBrandKit(kit, index) {
  if (!kit || typeof kit !== 'object' || Array.isArray(kit)) return null
  const style = extractBrandKitStyle(kit.style)
  if (!Object.keys(style).length) return null
  const name = String(kit.name || `Imported Brand Kit ${index + 1}`).trim().slice(0, 80)
  return {
    id: `brand-kit-${Date.now()}-${index}`,
    name: name || `Imported Brand Kit ${index + 1}`,
    style,
    updated_at: new Date().toISOString(),
  }
}

export function createBrandKitDocument(brandKits = []) {
  return {
    schema: BRAND_KIT_DOCUMENT_SCHEMA,
    version: BRAND_KIT_DOCUMENT_VERSION,
    exported_at: new Date().toISOString(),
    brand_kits: (Array.isArray(brandKits) ? brandKits : [])
      .slice(0, MAX_BRAND_KITS)
      .map((kit) => ({
        name: String(kit?.name || 'Brand Kit').trim().slice(0, 80) || 'Brand Kit',
        style: extractBrandKitStyle(kit?.style),
      }))
      .filter((kit) => Object.keys(kit.style).length > 0),
  }
}

export function parseBrandKitDocument(source) {
  let document
  try {
    document = typeof source === 'string' ? JSON.parse(source) : source
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('This is not a Lekha brand-kit file.')
  }
  if (document.schema !== BRAND_KIT_DOCUMENT_SCHEMA || document.version !== BRAND_KIT_DOCUMENT_VERSION) {
    throw new Error('This brand-kit file uses an unsupported schema or version.')
  }
  if (!Array.isArray(document.brand_kits)) {
    throw new Error('This brand-kit file does not contain a brand_kits list.')
  }
  const kits = document.brand_kits
    .slice(0, MAX_BRAND_KITS)
    .map(normalizeBrandKit)
    .filter(Boolean)
  if (!kits.length) throw new Error('No usable brand kits were found in this file.')
  return kits
}

export function mergeBrandKits(current = [], imported = []) {
  const byIdentity = new Map()
  ;[...(Array.isArray(imported) ? imported : []), ...(Array.isArray(current) ? current : [])]
    .forEach((kit) => {
      const identity = String(kit?.name || '').trim().toLocaleLowerCase()
      if (identity && !byIdentity.has(identity)) byIdentity.set(identity, kit)
    })
  return [...byIdentity.values()].slice(0, MAX_BRAND_KITS)
}
