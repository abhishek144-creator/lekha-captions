const SCRIPT_RANGES = {
  devanagari: [[0x0900, 0x097F]],
  bengali: [[0x0980, 0x09FF]],
  punjabi: [[0x0A00, 0x0A7F]],
  gujarati: [[0x0A80, 0x0AFF]],
  odia: [[0x0B00, 0x0B7F]],
  tamil: [[0x0B80, 0x0BFF]],
  telugu: [[0x0C00, 0x0C7F]],
  kannada: [[0x0C80, 0x0CFF]],
  malayalam: [[0x0D00, 0x0D7F]],
  sinhala: [[0x0D80, 0x0DFF]],
  manipuri: [[0xABC0, 0xABFF], [0xAAE0, 0xAAFF]],
  santali: [[0x1C50, 0x1C7F]],
  arabic: [[0x0600, 0x06FF]],
  hebrew: [[0x0590, 0x05FF]],
  japanese: [[0x3040, 0x309F], [0x30A0, 0x30FF]],
  chinese: [[0x4E00, 0x9FFF]],
  korean: [[0xAC00, 0xD7AF]],
  thai: [[0x0E00, 0x0E7F]],
  burmese: [[0x1000, 0x109F]],
  khmer: [[0x1780, 0x17FF]],
  lao: [[0x0E80, 0x0EFF]],
  tibetan: [[0x0F00, 0x0FFF]],
  georgian: [[0x10A0, 0x10FF], [0x1C90, 0x1CBF]],
  armenian: [[0x0530, 0x058F]],
  ethiopic: [[0x1200, 0x137F]],
}

export const SCRIPT_PRIMARY_FONTS = {
  devanagari: 'Noto Sans Devanagari',
  bengali: 'Noto Sans Bengali',
  punjabi: 'Noto Sans Gurmukhi',
  gujarati: 'Noto Sans Gujarati',
  odia: 'Noto Sans Oriya',
  tamil: 'Noto Sans Tamil',
  telugu: 'Noto Sans Telugu',
  kannada: 'Noto Sans Kannada',
  malayalam: 'Noto Sans Malayalam',
  sinhala: 'Noto Sans Sinhala',
  manipuri: 'Noto Sans Meetei Mayek',
  santali: 'Noto Sans Ol Chiki',
  arabic: 'Noto Sans Arabic',
  hebrew: 'Noto Sans Hebrew',
  japanese: 'Noto Sans JP',
  chinese: 'Noto Sans SC',
  korean: 'Noto Sans KR',
  thai: 'Noto Sans Thai',
  burmese: 'Noto Sans Myanmar',
  khmer: 'Noto Sans Khmer',
  lao: 'Noto Sans Lao',
  tibetan: 'Noto Serif Tibetan',
  georgian: 'Noto Sans Georgian',
  armenian: 'Noto Sans Armenian',
  ethiopic: 'Noto Sans Ethiopic',
}

const DEVANAGARI_FONT_NAMES = new Set([
  'Noto Sans Devanagari', 'Mukta', 'Hind', 'Poppins', 'Yantramanav',
  'Khand', 'Rajdhani', 'Teko', 'Kalam', 'Karma', 'Rozha One',
  'Vesper Libre', 'Amita', 'Shrikhand', 'Halant', 'Kurale', 'Arya',
  'Inknut Antiqua', 'Eczar', 'Sahitya', 'Rhodium Libre', 'Sumana',
  'Martel', 'Sura', 'Asar',
])

const LATIN_TO_DEVANAGARI_FONT = {
  'IBM Plex Mono': 'Karma',
  'Space Mono': 'Karma',
  'Special Elite': 'Karma',
  'Courier Prime': 'Karma',
  Oxanium: 'Rajdhani',
  Orbitron: 'Rajdhani',
  'Exo 2': 'Rajdhani',
  Syne: 'Yantramanav',
  Raleway: 'Mukta',
  'Josefin Sans': 'Mukta',
  Montserrat: 'Poppins',
  Poppins: 'Poppins',
  Inter: 'Poppins',
  'DM Sans': 'Hind',
  Anton: 'Teko',
  Antonio: 'Teko',
  'Bebas Neue': 'Khand',
  'Barlow Condensed': 'Khand',
  Oswald: 'Rajdhani',
  'Archivo Black': 'Yantramanav',
  'Bodoni Moda': 'Rozha One',
  'Playfair Display': 'Inknut Antiqua',
  Gloock: 'Rhodium Libre',
  'DM Serif Display': 'Vesper Libre',
  Cinzel: 'Arya',
  'Abril Fatface': 'Shrikhand',
  'Cormorant Garamond': 'Eczar',
  'EB Garamond': 'Kurale',
  'Libre Baskerville': 'Sumana',
  Spectral: 'Sura',
  Lora: 'Martel',
  Merriweather: 'Martel',
  'Noto Serif': 'Martel',
  Bitter: 'Sahitya',
  Caveat: 'Kalam',
  Pacifico: 'Kalam',
  'Dancing Script': 'Kalam',
}

function devanagariFallbackFor(fontFamily) {
  const family = String(fontFamily || '')
  if (/mono|courier|typewriter|plex mono|special elite/i.test(family)) return 'Karma'
  if (/oxanium|orbitron|syne|techno|exo/i.test(family)) return 'Rajdhani'
  if (/antonio|anton/i.test(family)) return 'Teko'
  if (/archivo black|black|heavy|ultra/i.test(family)) return 'Yantramanav'
  if (/condensed|narrow|oswald|bebas|barlow|impact|khand|teko/i.test(family)) return 'Khand'
  if (/cinzel|trajan|titling/i.test(family)) return 'Arya'
  if (/playfair|abril|fatface/i.test(family)) return 'Inknut Antiqua'
  if (/bodoni|didot|gloock/i.test(family)) return 'Rozha One'
  if (/dm serif|rozha|fat/i.test(family)) return 'Vesper Libre'
  if (/serif|garamond|baskerville|georgia|times|lora|bitter|merriweather|cormorant|spectral|noto serif/i.test(family)) return 'Eczar'
  if (/script|hand|caveat|pacifico|dancing|brush/i.test(family)) return 'Kalam'
  return SCRIPT_PRIMARY_FONTS.devanagari
}

export function detectScript(text) {
  const counts = new Map(Object.keys(SCRIPT_RANGES).map((script) => [script, 0]))
  let latinCount = 0

  for (const character of String(text || '')) {
    const codePoint = character.codePointAt(0)
    let matched = false
    for (const [script, ranges] of Object.entries(SCRIPT_RANGES)) {
      if (ranges.some(([start, end]) => codePoint >= start && codePoint <= end)) {
        counts.set(script, counts.get(script) + 1)
        matched = true
        break
      }
    }
    if (!matched && (
      (codePoint >= 0x0041 && codePoint <= 0x005A)
      || (codePoint >= 0x0061 && codePoint <= 0x007A)
    )) {
      latinCount += 1
    }
  }

  let dominantScript = 'latin'
  let dominantCount = latinCount
  counts.forEach((count, script) => {
    if (count > dominantCount) {
      dominantScript = script
      dominantCount = count
    }
  })
  return dominantScript
}

export function resolveScriptFontFamily(fontFamily, text, fontCatalog = {}) {
  const script = detectScript(text)
  const family = String(fontFamily || '').trim()
  if (script === 'latin') return family || 'Noto Sans'

  const catalogNames = (fontCatalog?.[script] || [])
    .map((font) => typeof font === 'string' ? font : font?.name)
    .filter(Boolean)
  const primaryFamily = catalogNames[0] || SCRIPT_PRIMARY_FONTS[script] || family || 'Noto Sans'

  if (!family) return primaryFamily
  if (script === 'devanagari') {
    if (DEVANAGARI_FONT_NAMES.has(family) || catalogNames.includes(family)) return family
    return LATIN_TO_DEVANAGARI_FONT[family] || devanagariFallbackFor(family)
  }

  return catalogNames.includes(family) ? family : primaryFamily
}
