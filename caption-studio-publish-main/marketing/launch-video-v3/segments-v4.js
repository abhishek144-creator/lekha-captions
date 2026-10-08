// Edit decision list for launch-v4.html (the first film's language, carried into the real editor).
// INTRO: kinetic hook → LAND. → iris into the logo → ink wipe → tagline → editor chapters.
// Chapters: take · from · len · pieces (jump cuts, dissolved) · cam [t, cx, cy, zoom] in the take's CSS px
//   (1813x1020; zoom 1 = full frame; cy 0 = top-anchored) · headline (typed like a caption over the
//   blurred footage, then a focus pull; `[word]` = amber box, `~words` = serif italic) ·
//   lifts: crops of the real frame flown to centre stage {t0, t1, src [x,y,w,h] CSS, dst [cx,cy,h] film px,
//   dst2/t2 optional second position, tag} · callouts as in v3.
// LANG_SEG and the end card are unchanged from v3.
;(function () {
  const F = [906.5, 510, 1]
  const INTRO = { land: 3.3, slam: 4.2, iris: 5.45, logo: 6.05, inkwipe: 8.35, tag: 8.95, edStart: 11.3 }
  const CARD1 = [85, 240, 270, 324], CARD2 = [85, 571, 270, 324], VIDEO = [733, 129, 407, 724]
  const list = [
    // staged upload (real screens): Upload Video 2.57 · pick file 4.21 · Generate 6.07 · generating · editor 9.95+
    { take: 'upload', from: 0.25, len: 8.6, pieces: [[0.25, 2.95], [4.0, 2.1], [8.35, 1.3], [9.95, 2.25]],
      headline: { kicker: '01 · UPLOAD', lines: [['Drop', 'in'], ['[any video.]']], sub: 'CAPTIONS IN SECONDS', t0: 0.05, t1: 1.2 },
      cam: [[0, ...F], [1.8, ...F], [2.5, 906, 500, 1.45], [6.0, 906, 500, 1.45], [6.6, ...F]],
      callouts: [{ t0: 6.9, t1: 8.4, x: 1100, y: 672, label: 'CAPTIONED · EVERY WORD TIMED', side: 'r' }] },
    // font size 2.10-3.56 · position Y 4.94-6.22 (no font-family change)
    { take: 'style', from: 0.25, len: 5.8, pieces: [[0.25, 3.45], [4.45, 2.35]],
      headline: { kicker: '02 · STYLE', lines: [['Make', 'it'], ['[yours.]']], sub: 'SIZE · POSITION', t0: 0.05, t1: 1.1 },
      cam: [[0, ...F], [1.25, ...F], [1.85, 1300, 0, 1.3], [5.2, 1300, 0, 1.3], [5.8, ...F]],
      callouts: [{ t0: 2.0, t1: 3.3, x: 1518, y: 329, label: 'FONT SIZE 17 → 35PX', side: 'l' },
                 { t0: 4.0, t1: 5.4, x: 1518, y: 708, label: 'CAPTION POSITION', side: 'l' }] },
    // word click 2.47 · word size 4.06-5.15 · Style tab 6.52 · orange 7.85
    { take: 'floating', from: 0.45, len: 6.15, pieces: [[0.45, 2.45], [3.85, 1.5], [6.3, 2.2]],
      headline: { kicker: '03 · ONE WORD', lines: [['Every', 'word,'], ['~your call.']], sub: 'FLOATING WORD EDITOR', t0: 0.05, t1: 1.35 },
      cam: [[0, ...F], [1.5, ...F], [2.1, 1110, 0, 1.35], [5.75, 1110, 0, 1.35], [6.15, ...F]],
      callouts: [{ t0: 1.55, t1: 2.4, x: 926, y: 690, label: 'CLICK ANY WORD', side: 'd' }] },
    // gallery opens 2.51 · both cards lifted out of the gallery at real speed
    { take: 'templates', from: 1.3, len: 6.0,
      headline: { kicker: '04 · TEMPLATES', lines: [['100+', 'templates.'], ['~Real motion.']], sub: 'LIVE PREVIEWS', t0: 0.05, t1: 1.05 },
      cam: [[0, ...F]],
      lifts: [{ t0: 1.9, t1: 6.0, src: CARD1, dst: [960, 540, 680], dst2: [655, 540, 680], t2: 3.5, r: 14, tag: 'MESSY · <b>LC T166</b>' },
              { t0: 3.6, t1: 6.0, src: CARD2, dst: [1265, 540, 680], r: 14, tag: 'MOUNTAINS · <b>LC T167</b>' }] },
    // one click on T167 at 10.57, just before a line starts → the template animates in on its own
    { take: 'templates', from: 9.85, len: 5.4,
      headline: { kicker: '05 · ONE CLICK', lines: [['One', 'click.'], ['[Animated.]']], sub: 'LC T167 · MOUNTAINS', t0: 1.15, t1: 5.0, side: true, noBlur: true },
      cam: [[0, ...F]],
      lifts: [{ t0: 1.0, t1: 5.4, src: VIDEO, dst: [1290, 540, 960], r: 4, dim: 0.72 }] },
    // export-mock.html over the real editor: EXPORT 1.70 · 1080p 4.79 · ready 7.79
    { take: 'export', from: 0.6, len: 8.6,
      headline: { kicker: '06 · EXPORT', lines: [['Export', 'in'], ['[HD & 4K.]']], sub: 'SRT · VTT · 1080P · 4K', t0: 0.05, t1: 0.95 },
      cam: [[0, ...F], [1.5, ...F], [2.2, 1400, 0, 1.42], [6.9, 1400, 0, 1.42], [7.6, ...F]] },
  ]
  let t = INTRO.edStart
  for (const s of list) {
    s.start = t
    s.frames = ((window.TAKE_LOGS || {})[s.take] || {}).frames30 || 9999
    t += s.len
  }
  // languages: the same template recorded on the preview in four languages (crop = preview in take px)
  const crop = [1320, 258, 680, 1208]
  const LANG_SEG = { start: t, len: 3.6, cards: ['en', 'es', 'hi', 'ar'].map((l) => ({
    take: `lang-${l}`, from: 0.15, crop, frames: ((window.TAKE_LOGS || {})[`lang-${l}`] || {}).frames30 || 9999,
    label: { en: 'ENGLISH', es: 'ESPAÑOL', hi: 'हिन्दी', ar: 'العربية' }[l] })) }
  t += LANG_SEG.len
  window.FILM = { INTRO, SEGMENTS: list, LANG_SEG, END_AT: t - 0.2, DURATION: t + 3.9 }
})()
