// Edit decision list for launch-v3.html.
// take: recorded clip in takes/<take>/ (30 fps jpgs) · from: take-local start (s) · len: seconds on screen
// pieces: optional jump cuts [[from, len], ...] of the same take, joined by a short dissolve
// cont: the section continues the previous section's take (no dissolve between them)
// cam: [segment-local t, centerX, centerY, zoom] in the take's CSS px (editor takes: 1813x1020).
//   Zoom 1 = the whole editor, full frame. The camera only leans in (≤1.42) around a click/selection and
//   returns to full frame; centerY 0 anchors the view to the top so the editor's top bar stays in shot.
// callouts: label pinned to a UI point (take CSS px), side = where the label sits
;(function () {
  const F = [906.5, 510, 1] // whole editor
  const seg = (o) => o
  const list = [
    seg({ take: 'intro', from: 0.5, len: 4.0, title: 'Auto-transcribed', sub: 'every word timed',
      cam: [[0, ...F]],
      callouts: [{ t0: 0.7, t1: 3.4, x: 272, y: 258, label: 'TIMED LINE BY LINE', side: 'r' }] }),
    // font size drag (take 1.21-3.04) · font family Bebas Neue (4.67-6.76) · position Y drag (8.36-9.60)
    seg({ take: 'style', from: 0.95, len: 7.55, title: 'Style every detail', sub: 'font · size · position',
      pieces: [[0.95, 2.45], [4.25, 2.95], [8.05, 2.15]],
      cam: [[0, ...F], [0.15, ...F], [0.85, 1300, 0, 1.3], [6.95, 1300, 0, 1.3], [7.55, ...F]],
      callouts: [{ t0: 0.5, t1: 2.3, x: 1518, y: 329, label: 'FONT SIZE 17 → 35PX', side: 'l' },
                 { t0: 2.9, t1: 5.2, x: 1518, y: 261, label: 'GOOGLE FONTS · BEBAS NEUE', side: 'l' }] }),
    // word click 1.57 · EMPHASIZE 3.43 · Style tab 5.03 · black 6.32 · Animate tab 7.99 · Pop 9.17 · replay
    seg({ take: 'floating', from: 1.0, len: 8.4, title: 'Edit a single word', sub: 'floating word editor',
      pieces: [[1.0, 2.9], [4.65, 2.3], [7.75, 3.2]],
      cam: [[0, ...F], [0.2, ...F], [0.9, 1110, 0, 1.35], [7.8, 1110, 0, 1.35], [8.4, ...F]],
      callouts: [{ t0: 0.25, t1: 1.5, x: 926, y: 690, label: 'CLICK ANY WORD', side: 'd' }] }),
    // gallery opens 1.63 · card 1 (Messy) from 2.1 · card 2 (Mountains, T167) from 5.0 — both at real speed
    // the camera leans in once the cursor is on the cards and stays there through the one-click apply
    seg({ take: 'templates', from: 1.0, len: 5.9, title: '100+ creative templates', sub: 'animated, ready to use',
      cam: [[0, ...F], [1.0, ...F], [1.7, 640, 560, 1.25]] }),
    // one click on T167 at 8.56, the line replays with the template
    seg({ take: 'templates', from: 6.9, len: 4.6, cont: true, title: 'One click. Animated.', sub: 'the real template engine',
      cam: [[0, 640, 560, 1.25], [3.95, 640, 560, 1.25], [4.6, ...F]] }),
    // export-mock.html over the real editor: EXPORT 1.70 · 1080p 4.79 · ready (100 %, toast) 7.79, held ~2 s
    seg({ take: 'export', from: 0.9, len: 9.2, title: 'Export', sub: 'HD & 4K · SRT · VTT',
      cam: [[0, ...F], [1.3, ...F], [2.1, 1400, 0, 1.42], [6.8, 1400, 0, 1.42], [7.5, ...F]] }),
  ]
  let t = 6.3
  for (const s of list) {
    s.start = t
    const meta = (window.TAKE_LOGS || {})[s.take] || {}
    s.frames = meta.frames30 || 9999
    t += s.len
  }
  // languages: the same template recorded on the preview in four languages (crop = preview in take px)
  const crop = [1320, 258, 680, 1208]
  const LANG_SEG = { start: t, len: 3.6, cards: ['en', 'es', 'hi', 'ar'].map((l) => ({
    take: `lang-${l}`, from: 0.15, crop, frames: ((window.TAKE_LOGS || {})[`lang-${l}`] || {}).frames30 || 9999,
    label: { en: 'ENGLISH', es: 'ESPAÑOL', hi: 'हिन्दी', ar: 'العربية' }[l] })) }
  t += LANG_SEG.len
  window.FILM = { SEGMENTS: list, LANG_SEG, END_AT: t - 0.2, DURATION: t + 3.9 }
})()
