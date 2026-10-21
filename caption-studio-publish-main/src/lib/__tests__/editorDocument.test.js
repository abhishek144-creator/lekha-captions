import { describe, expect, it } from 'vitest'
import {
  defaultCaptionStyle,
  emptyEditorDocument,
  getLanguageDisplayName,
  compactDraftForStorage,
  getLanguageIdentity,
  normalizeCaptionStyle,
  normalizeRestoredCaptionTrackState,
  restoreEditorDocument,
  sanitizeRestoredCaption,
} from '../editorDocument'

const caption = (id, extra = {}) => ({ id, text: `caption ${id}`, start_time: 0, end_time: 1, ...extra })

describe('sanitizeRestoredCaption', () => {
  it('keeps captions from template sets that still ship', () => {
    const live = caption('a', { template_source: 'lekha-lc', template_id: 't1' })
    expect(sanitizeRestoredCaption(live)).toBe(live)
  })

  it('strips template fields from a removed template set', () => {
    const removed = caption('a', {
      template_source: 'lekha-49',
      template_id: 't9',
      template_markup: '<div/>',
      applied_template_style: { template_source: 'lekha-49' },
    })
    const restored = sanitizeRestoredCaption(removed)
    expect(restored.template_id).toBeUndefined()
    expect(restored.template_markup).toBeUndefined()
    expect(restored.applied_template_style).toBeUndefined()
    expect(restored.text).toBe('caption a')
  })

  it('leaves text elements untouched', () => {
    const element = caption('t', { isTextElement: true, template_source: 'lekha-49' })
    expect(sanitizeRestoredCaption(element)).toBe(element)
  })
})

describe('normalizeRestoredCaptionTrackState', () => {
  it('drops tracks without an id or captions and duplicate ids', () => {
    const state = normalizeRestoredCaptionTrackState([
      { id: 'source', captions: [caption('1')] },
      { id: 'source', captions: [caption('dup')] },
      { id: '', captions: [caption('x')] },
      { id: 'hi', captions: 'not-an-array' },
    ], [], 'source')
    expect(state.tracks.map((track) => track.id)).toEqual(['source'])
    expect(state.captions.map((item) => item.id)).toEqual(['1'])
  })

  it('selects the requested track and falls back to the first', () => {
    const tracks = [
      { id: 'source', captions: [caption('en')] },
      { id: 'translation-hindi', captions: [caption('hi')] },
    ]
    expect(normalizeRestoredCaptionTrackState(tracks, [], 'translation-hindi').captions[0].id).toBe('hi')
    expect(normalizeRestoredCaptionTrackState(tracks, [], 'missing').activeTrackId).toBe('source')
  })

  it('builds an original track from legacy drafts that only stored captions', () => {
    const state = normalizeRestoredCaptionTrackState(undefined, [caption('1')], undefined, 'Hindi')
    expect(state.tracks).toHaveLength(1)
    expect(state.tracks[0]).toMatchObject({ id: 'source', language: 'Hindi', label: 'Original · Hindi' })
    expect(state.activeTrackId).toBe('source')
  })
})

describe('normalizeCaptionStyle', () => {
  it('fills missing fields from the default style', () => {
    expect(normalizeCaptionStyle({ text_color: '#ff0000' })).toMatchObject({
      text_color: '#ff0000',
      font_family: defaultCaptionStyle.font_family,
      position_y: 80,
    })
  })

  it('upgrades the old thin default caption style', () => {
    const style = normalizeCaptionStyle({ font_size: 16, font_weight: '500', has_shadow: false })
    expect(style).toMatchObject({ font_size: 17, font_weight: '800', has_shadow: true })
  })

  it('does not touch a template-owned small style', () => {
    const style = normalizeCaptionStyle({ template_id: 't12', font_size: 16, font_weight: '500' })
    expect(style).toMatchObject({ font_size: 16, font_weight: '500' })
  })
})

describe('restoreEditorDocument', () => {
  it('returns a complete document with defaults for missing fields', () => {
    expect(restoreEditorDocument({})).toEqual({
      ...emptyEditorDocument(),
      captionStyle: normalizeCaptionStyle(defaultCaptionStyle),
    })
  })

  it('deep-copies so editing the restored document never mutates the draft', () => {
    const draft = {
      videoUrl: '/v.mp4',
      fileId: 'f1',
      captions: [caption('1', { wordStyles: { '1-0': { color: 'red' } } })],
      settings: { language: 'hindi', style: 'viral_hook' },
    }
    const restored = restoreEditorDocument(draft)
    restored.captions[0].wordStyles['1-0'].color = 'blue'
    restored.settings.language = 'english'
    expect(draft.captions[0].wordStyles['1-0'].color).toBe('red')
    expect(draft.settings.language).toBe('hindi')
    expect(restored.captionTracks[0].captions[0].id).toBe('1')
  })
})

describe('language helpers', () => {
  it('names language codes and treats regional variants as the same language', () => {
    expect(getLanguageDisplayName('hi')).toBe('Hindi')
    expect(getLanguageDisplayName('')).toBe('Original')
    expect(getLanguageIdentity('en-US')).toBe(getLanguageIdentity('english'))
    expect(getLanguageIdentity('hi')).not.toBe(getLanguageIdentity('en'))
  })
})

describe('compactDraftForStorage', () => {
  const markup = '<div class="btcard">'.padEnd(3000, 'x') + '</div>'
  const templated = (id) => caption(id, {
    template_id: 't-106',
    template_source: 'lekha-basic',
    template_markup: markup,
    applied_template_style: { template_id: 't-106', template_source: 'lekha-basic', template_markup: markup, font_family: 'Inter' },
  })
  const templatedDraft = () => {
    const captions = [templated('a'), templated('b')]
    return {
      captions,
      captionTracks: [{ id: 'source', label: 'Original', captions }],
      activeCaptionTrackId: 'source',
      captionStyle: { ...defaultCaptionStyle, template_id: 't-106', template_source: 'lekha-basic', template_snapshot: { template_id: 't-106', template_source: 'lekha-basic', template_markup: markup } },
    }
  }

  it('stores the shared template markup once instead of on every caption', () => {
    const draft = templatedDraft()
    const compact = compactDraftForStorage(draft)
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(draft).length / 3)
    expect(compact.captions[0].template_markup).toBeUndefined()
    expect(compact.captions[0].applied_template_style.template_markup).toBeUndefined()
    expect(compact.captionTracks[0].captions[1].template_markup).toBeUndefined()
    // The input is not modified.
    expect(draft.captions[0].template_markup).toBe(markup)
  })

  it('restores the markup on every caption when the draft is opened', () => {
    const restored = restoreEditorDocument(JSON.parse(JSON.stringify(compactDraftForStorage(templatedDraft()))))
    for (const item of [...restored.captions, ...restored.captionTracks[0].captions]) {
      expect(item.template_markup).toBe(markup)
      expect(item.applied_template_style.template_markup).toBe(markup)
      expect(item.template_markup_shared).toBeUndefined()
      expect(item.applied_template_style.template_markup_shared).toBeUndefined()
    }
  })

  it('keeps a caption markup that differs from the shared one', () => {
    const draft = templatedDraft()
    draft.captions[1] = { ...draft.captions[1], template_markup: '<div>own</div>' }
    const restored = restoreEditorDocument(compactDraftForStorage(draft))
    expect(restored.captions[1].template_markup).toBe('<div>own</div>')
  })

  it('leaves drafts without a template unchanged', () => {
    const draft = { captions: [caption('a')], captionStyle: defaultCaptionStyle }
    expect(compactDraftForStorage(draft)).toBe(draft)
  })
})
