import { describe, expect, it } from 'vitest'
import { getDefaultCaptionFont, applyDefaultCaptionFont, preserveCustomCaptionFont } from '../defaultCaptionFonts.js'
import { defaultCaptionStyle, restoreEditorDocument } from '../editorDocument.js'
import { buildTemplateApplication } from '../templateApplication.js'
import { resolveScriptFont } from '../../components/dashboard/fontUtils.jsx'
import { resolveScriptFontFamily } from '../../components/dashboard/scriptFontResolver.js'

const samples = [
  ['Hello world', 'Inter'], ['Bonjour déjà', 'Inter'], ['Tiếng Việt', 'Inter'],
  ['नमस्ते दुनिया', 'Noto Sans Devanagari'], ['স্বাগতম', 'Noto Sans Bengali'],
  ['ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'Noto Sans Gurmukhi'], ['ગુજરાતી', 'Noto Sans Gujarati'],
  ['ଓଡ଼ିଆ', 'Noto Sans Oriya'], ['வணக்கம்', 'Noto Sans Tamil'],
  ['నమస్కారం', 'Noto Sans Telugu'], ['ನಮಸ್ಕಾರ', 'Noto Sans Kannada'],
  ['നമസ്കാരം', 'Noto Sans Malayalam'], ['සිංහල', 'Noto Sans Sinhala'],
  ['ꯃꯤꯇꯩ', 'Noto Sans Meetei Mayek'], ['ᱥᱟᱱᱛᱟᱲᱤ', 'Noto Sans Ol Chiki'],
  ['مرحبا', 'Noto Sans Arabic'], ['اردو زبان', 'Noto Sans Arabic'],
  ['שלום', 'Noto Sans Hebrew'], ['日本語の字幕', 'Noto Sans JP'],
  ['中文字幕', 'Noto Sans SC'], ['한국어 자막', 'Noto Sans KR'],
  ['ภาษาไทย', 'Noto Sans Thai'], ['မြန်မာ', 'Noto Sans Myanmar'],
  ['ខ្មែរ', 'Noto Sans Khmer'], ['ພາສາລາວ', 'Noto Sans Lao'],
  ['བོད་ཡིག', 'Noto Serif Tibetan'], ['ქართული', 'Noto Sans Georgian'],
  ['հայերեն', 'Noto Sans Armenian'], ['አማርኛ', 'Noto Sans Ethiopic'],
  ['Русские субтитры', 'Noto Sans'], ['Ελληνικοί υπότιτλοι', 'Noto Sans'],
]

describe('language default caption fonts', () => {
  it.each(samples)('selects a readable native-script family for %s', (text, family) => {
    const font = getDefaultCaptionFont(text)
    expect(font.font_family).toBe(family)
    expect(resolveScriptFont(family, text)).toBe(family)
    expect(resolveScriptFontFamily(family, text)).toBe(family)
  })

  it.each(['chinese_traditional', 'chinese_cantonese', 'zh-Hant', 'zh-TW', 'yue-HK'])('uses regional Traditional Chinese glyphs for %s', (language) => {
    expect(getDefaultCaptionFont('歡迎觀看', language).font_family).toBe('Noto Sans TC')
  })

  it('uses language context for Han-only Japanese and actual text for romanised speech', () => {
    expect(getDefaultCaptionFont('東京物語', 'ja').font_family).toBe('Noto Sans JP')
    expect(getDefaultCaptionFont('東京物語', 'Japanese').font_family).toBe('Noto Sans JP')
    expect(getDefaultCaptionFont('Hello world', 'hindi').font_family).toBe('Inter')
    expect(getDefaultCaptionFont('नमस्ते दुनिया', 'English').font_family).toBe('Noto Sans Devanagari')
    expect(getDefaultCaptionFont('This is a mostly English line with नमस्ते', 'hinglish').font_family).toBe('Noto Sans Devanagari')
  })

  it('returns the same native default on upload and when None removes a template', () => {
    for (const [text] of samples) {
      const result = buildTemplateApplication({ templateStyle: {}, captionStyle: { ...defaultCaptionStyle, template_id: 't12' }, captions: [{ id: 'line', text }] })
      expect(result.style).toMatchObject(getDefaultCaptionFont(text))
      expect(result.templateSnapshot).toBeNull()
    }
  })

  it('follows translated tracks only while typography is automatic', () => {
    const hindi = applyDefaultCaptionFont(defaultCaptionStyle, [{ text: 'नमस्ते दुनिया' }], 'Hindi', true)
    expect(applyDefaultCaptionFont(hindi, [{ text: 'Hello world' }], 'English').font_family).toBe('Inter')
    const custom = preserveCustomCaptionFont(hindi, { ...hindi, font_family: 'Mukta' })
    expect(applyDefaultCaptionFont(custom, [{ text: 'Hello world' }], 'English')).toBe(custom)
    expect(preserveCustomCaptionFont(hindi, { ...hindi, text_color: '#ff0000' }).font_source).toBe('language-default')
  })

  it('preserves saved typography, template choices, text elements and automatic mode on reload', () => {
    const legacy = { ...defaultCaptionStyle, font_family: 'Mukta' }
    expect(applyDefaultCaptionFont(legacy, [{ text: 'Hello world' }])).toBe(legacy)
    const templated = { ...legacy, template_id: 't12', font_source: 'language-default' }
    expect(applyDefaultCaptionFont(templated, [{ text: 'Hello world' }])).toBe(templated)
    const automatic = applyDefaultCaptionFont(defaultCaptionStyle, [{ text: 'Hello world' }, { text: 'नमस्ते दुनिया', isTextElement: true }], '', true)
    expect(automatic.font_family).toBe('Inter')
    expect(restoreEditorDocument({ captions: [{ id: 'line', text: 'Hello world' }], captionStyle: automatic }).captionStyle).toMatchObject(automatic)
  })
})
