// Colour value helpers for editor controls. Stored editor colours are
// '#rrggbb'; browsers report computed colours as rgb()/rgba().

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

// '#ABC', 'abc', '#aabbcc' -> '#aabbcc'; anything else -> ''.
export function normalizeHexColor(value) {
  const match = HEX_RE.exec(String(value ?? '').trim())
  if (!match) return ''
  const digits = match[1].length === 3
    ? match[1].split('').map((digit) => digit + digit).join('')
    : match[1]
  return `#${digits.toLowerCase()}`
}

// A hex colour or a computed 'rgb(r, g, b)' / 'rgba(r, g, b, a)' -> '#rrggbb'.
// Fully transparent colours (e.g. gradient-clipped text) return ''.
export function cssColorToHex(value) {
  const hex = normalizeHexColor(value)
  if (hex) return hex
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(String(value ?? '').trim())
  if (!match) return ''
  const alpha = match[4] === undefined ? 1 : (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4]))
  if (alpha === 0) return ''
  const channel = (raw) => Math.max(0, Math.min(255, Math.round(Number(raw)))).toString(16).padStart(2, '0')
  return `#${channel(match[1])}${channel(match[2])}${channel(match[3])}`
}

// '#rrggbb' (or '#rgb') + alpha -> 'rgba(...)'. Invalid colours fall back so a
// bad stored value never produces invalid CSS (which silently paints nothing).
export function hexToRgba(value, alpha = 1, fallback = '#000000') {
  const hex = normalizeHexColor(value) || normalizeHexColor(fallback) || '#000000'
  const safeAlpha = Number.isFinite(Number(alpha)) ? Math.max(0, Math.min(1, Number(alpha))) : 1
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`
}
