import { detectScript, SCRIPT_PRIMARY_FONTS } from '../components/dashboard/scriptFontResolver.js'

// Caption defaults favour clear, open letterforms and complete native-script
// coverage. Noto's matching families keep comparable weight across languages.
// Language only disambiguates shared Han characters; actual written text wins
// for romanised speech and translations.
export function getDefaultCaptionFont(text, language = '') {
  const sample = String(text || '')
  const locale = String(language || '').toLowerCase().replace(/[_\s]+/g, '-')
  // Native faces also contain Latin. A short native-script word in a mostly
  // English caption still needs that coverage (Inter cannot draw Indic text).
  let script = detectScript(sample.replace(/\p{Script=Latin}/gu, ''))
  if (/[\u3040-\u30ff]/u.test(sample)) script = 'japanese'
  else if (script === 'chinese') {
    if (/^(ja(?:-|$)|japanese)/.test(locale)) script = 'japanese'
    else if (/^(ko(?:-|$)|korean)/.test(locale)) script = 'korean'
  } else if (script === 'latin') {
    if (/\p{Script=Cyrillic}/u.test(sample)) script = 'cyrillic'
    else if (/\p{Script=Greek}/u.test(sample)) script = 'greek'
  }
  const traditionalChinese = script === 'chinese'
    && /traditional|cantonese|hant|(?:^|-)(?:tw|hk|mo)(?:-|$)|^yue(?:-|$)/.test(locale)
  return {
    font_family: traditionalChinese ? 'Noto Sans TC'
      : script === 'latin' ? 'Inter'
        : SCRIPT_PRIMARY_FONTS[script] || 'Noto Sans',
    font_weight: script === 'latin' ? '800' : '700',
    detected_script: script,
    font_source: 'language-default',
  }
}

export function applyDefaultCaptionFont(style, captions, language = '', force = false) {
  if (style.template_id || style.template_20_id || (!force && style.font_source !== 'language-default')) return style
  const text = (captions || []).filter((caption) => caption && !caption.isTextElement).map((caption) => caption.text || '').join(' ')
  const font = getDefaultCaptionFont(text, language)
  if (Object.entries(font).every(([key, value]) => style[key] === value)) return style
  return { ...style, ...font }
}

// Explicit typography edits opt out; colour/position edits retain language
// defaults. Legacy drafts without the marker keep their saved font choices.
export function preserveCustomCaptionFont(previous, next) {
  return ['font_family', 'font_weight', 'font_style'].some((key) => previous[key] !== next[key])
    ? { ...next, font_source: 'custom' }
    : next
}
