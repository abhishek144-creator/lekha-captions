// Edit decision list for launch-v5.html — "Self-captioned": the film narrates itself in subtitles.
//   COLD   result first: the finished 9:16 clip (real T167 preview pixels, cropped out of the templates take)
//   SETTLE the clip settles into its place in the editor while the editor fades in around it
//   REWIND fast reverse scrub through the real takes back to the empty editor (lands on upload's first frame)
//   then the editor chapters, each entered by a playhead wipe; languages + end card unchanged from v3/v4.
// Chapters: take · pieces [[from, len], …] (jump cuts) · cam [t, cx, cy, zoom] in the take's CSS px
//   (1813x1020; zoom 1 = full frame; cy 0 = top-anchored; lean-ins ≤1.35 only around a click) ·
//   cues: subtitle lines {t0, t1, text, at?} in chapter time; `at` pins individual words to a time
//   (e.g. "pop." on the orange click), the others follow at PACE.
;(function () {
  const F = [906.5, 510, 1]
  const PACE = 0.27
  // the clip = the preview without its REC / 9:16 badges and scrubber (CSS px of the templates take)
  const CLIP = { take: 'templates', from: 12.45, end: 16.25, src: [750, 168, 372, 662], dst: [960, 500, 860] }
  const COLD = { settle: [3.5, 0.6],
    cues: [{ t0: 0.3, t1: 1.75, text: 'Watch the captions.' }, { t0: 1.9, t1: 3.75, text: 'Now watch them being made.' }] }
  // reverse scrub: [take, from, to] played backwards, eased in and out, landing on upload's first frame
  const REWIND = { start: 3.8, len: 1.7, runs: [['templates', 16.25, 0.2], ['floating-v5', 16.3, 0.2], ['upload', 14.8, 1.1]] }
  const list = [
    // staged upload (real screens): Upload Video 2.57 · pick file 4.21 · Generate 6.07 · generating · editor 9.95+  (film ≤45 s: idle frames trimmed)
    { take: 'upload', len: 7.4, pieces: [[1.1, 2.1], [4.1, 2.05], [8.35, 1.2], [9.95, 2.05]], wipe: false,
      cam: [[0, ...F], [1.0, ...F], [1.65, 906, 500, 1.35], [4.6, 906, 500, 1.35], [5.2, ...F]],
      cues: [{ t0: 0.35, t1: 3.1, text: 'Drop in any video.' }, { t0: 3.9, t1: 7.25, text: 'Lekha transcribes and times every word.' }] },
    // drag 1.70–3.13 · click the moved word 4.71 · size 6.31–7.44 · Style 8.84 · orange 10.14 · (close 12.07 cut) · plays 13+
    { take: 'floating-v5', len: 8.85, pieces: [[1.45, 1.75], [4.5, 2.95], [8.65, 1.75], [13.4, 2.4]],
      cam: [[0, ...F], [0.15, ...F], [0.8, 1060, 470, 1.3], [6.45, 1060, 470, 1.3], [7.05, ...F]],
      cues: [{ t0: 0.2, t1: 2.9, text: 'Drag one word anywhere.' },
             { t0: 3.2, t1: 8.0, text: 'Size it up. Make it pop.', at: [3.45, 3.7, 3.95, 5.6, 5.85, 6.19] }] },
    // gallery 2.51 · card 1 (3.02) · card 2 (5.96) — in place, real speed · one click on T167 at 10.57, just before a line
    { take: 'templates', len: 8.0, pieces: [[2.0, 3.0], [5.8, 2.0], [10.2, 3.0]],
      cam: [[0, ...F], [4.95, ...F], [5.4, 600, 510, 1.22], [7.3, 600, 510, 1.22], [7.95, ...F]],
      cues: [{ t0: 0.6, t1: 4.6, text: 'Browse 100+ animated templates.' },
             { t0: 5.0, t1: 7.85, text: 'One click. It moves.', at: [5.1, 5.37, 6.15, 6.42] }] },
    // export-mock.html over the real editor: EXPORT 1.72 · 1080p 4.78 · ready 7.79
    { take: 'export', len: 7.15, pieces: [[1.0, 4.15], [6.75, 3.0]],
      cam: [[0, ...F], [1.1, ...F], [1.8, 1400, 0, 1.35], [5.6, 1400, 0, 1.35], [6.3, ...F]],
      cues: [{ t0: 0.4, t1: 3.6, text: 'Export in HD, up to 4K.' }, { t0: 5.0, t1: 7.0, text: 'Ready to post.', at: [5.2, 5.45, 5.7] }] },
  ]
  let t = REWIND.start + REWIND.len
  for (const s of list) {
    s.start = t
    s.frames = ((window.TAKE_LOGS || {})[s.take] || {}).frames30 || 9999
    t += s.len
  }
  // languages: the same template recorded on the preview in four languages (crop = preview in take px) — as v3/v4
  const crop = [1320, 258, 680, 1208]
  const LANG_SEG = { start: t, len: 3.6, cards: ['en', 'es', 'hi', 'ar'].map((l) => ({
    take: `lang-${l}`, from: 0.15, crop, frames: ((window.TAKE_LOGS || {})[`lang-${l}`] || {}).frames30 || 9999,
    label: { en: 'ENGLISH', es: 'ESPAÑOL', hi: 'हिन्दी', ar: 'العربية' }[l] })) }
  t += LANG_SEG.len
  // every subtitle cue in film time, numbered like an .srt file
  const CUES = []
  const addCue = (base, c) => {
    const words = c.text.split(' ')
    const times = words.map((_, i) => base + (c.at && c.at[i] != null ? c.at[i] : c.t0 + 0.12 + i * PACE))
    CUES.push({ n: CUES.length + 1, t0: base + c.t0, t1: base + c.t1, words, times })
  }
  COLD.cues.forEach((c) => addCue(0, c))
  list.forEach((s) => (s.cues || []).forEach((c) => addCue(s.start, c)))
  window.FILM = { CLIP, COLD, REWIND, SEGMENTS: list, LANG_SEG, CUES, WIPE: 0.6, END_AT: t - 0.2, DURATION: t + 3.9 }
})()
