// Edit decision list for launch-v6.html — "Say it once.": the film is narrated by the sample clip's own transcript.
//   The four transcript lines of morning-walk.mov are the four chapter cards, set exactly as the editor's caption
//   list wraps them. Each card's amber word flies into the thing that gets clicked next (the Upload button, the
//   word itself, the Templates rail icon, EXPORT) and the footage irises open around it. No text over footage.
// Chapters: card {n, lines, key, tc, dur, target [cx, cy, w, h] in take CSS px} · take · pieces [[from, len], …]
//   (jump cuts) · cam [t, cx, cy, zoom] (1813x1020 CSS px; zoom 1 = full frame; lean-ins ≤1.35 only around a click).
//   The first FLY seconds of every chapter stay full frame: that is where the card's word lands.
;(function () {
  const F = [906.5, 510, 1]
  const FLY = 0.62
  const list = [
    // staged upload (real screens): Upload Video 2.57 · pick file 4.21 · Generate 6.07 · generating · editor 9.95+
    { card: { n: '01', tc: '0:00.0 - 0:02.2', dur: '2.2s', lines: ['this place taught me', 'one thing'], key: 'one', len: 2.15,
        target: [906, 648, 187, 38] },
      take: 'upload', pieces: [[1.1, 2.0], [4.1, 1.95], [8.35, 1.1], [9.95, 1.75]],
      cam: [[0, ...F], [1.0, ...F], [1.6, 906, 500, 1.35], [4.5, 906, 500, 1.35], [5.1, ...F]] },
    // drag 1.70–3.13 · click the moved word 4.71 · size 6.31–7.44 · Style 8.84 · orange 10.14 · (close 12.07 cut) · plays 13.4+
    // the card's "strategy," lands on the real word in the preview line (match cut), then that word is dragged out
    { card: { n: '02', tc: '0:02.3 - 0:05.0', dur: '2.7s', lines: ['humility is a strategy,', 'not weakness.'], key: 'strategy,', len: 1.75,
        target: [930, 671, 74, 20] },
      take: 'floating-v5', pieces: [[1.15, 2.05], [4.5, 2.8], [8.65, 1.6], [13.4, 2.0]],
      cam: [[0, ...F], [0.65, ...F], [1.25, 1060, 470, 1.3], [6.5, 1060, 470, 1.3], [7.1, ...F]] },
    // Templates rail icon 2.51 · gallery cards play in place, real speed · one click on T167 at 10.57, just before a line
    { card: { n: '03', tc: '0:05.1 - 0:07.6', dur: '2.5s', lines: ['slow mornings build', 'loud lives.'], key: 'loud', len: 1.75,
        target: [35, 558, 34, 34] },
      take: 'templates', pieces: [[1.55, 3.3], [5.8, 1.8], [10.2, 2.8]],
      cam: [[0, ...F], [5.0, ...F], [5.4, 600, 510, 1.22], [7.2, 600, 510, 1.22], [7.8, ...F]] },
    // export-mock.html over the real editor: EXPORT 1.72 · 1080p 4.78 · ready 7.79
    { card: { n: '04', tc: '0:07.7 - 0:11.0', dur: '3.3s', lines: ['say it once. let them', 'read it.'], key: 'once.', len: 1.75,
        target: [1734, 27, 114, 30] },
      take: 'export', pieces: [[1.0, 4.0], [6.75, 2.6]],
      cam: [[0, ...F], [1.0, ...F], [1.7, 1400, 0, 1.35], [5.3, 1400, 0, 1.35], [6.0, ...F]] },
  ]
  let t = 0
  list.forEach((s, si) => {
    // card word times (card time): read in at an even pace, the first card a touch slower
    const n = s.card.lines.join(' ').split(' ').length, pace = si === 0 ? 0.15 : 0.11, w0 = si === 0 ? 0.3 : 0.2
    s.card.times = Array.from({ length: n }, (_, i) => w0 + i * pace)
    s.card.start = t
    t += s.card.len
    s.start = t
    s.len = s.pieces.reduce((n, p) => n + p[1], 0)
    s.frames = ((window.TAKE_LOGS || {})[s.take] || {}).frames30 || 9999
    t += s.len
  })
  // languages: the same template recorded on the preview in four languages (crop = preview in take px) — as v3–v5
  const crop = [1320, 258, 680, 1208]
  const LANG_SEG = { start: t, len: 3.6, cards: ['en', 'es', 'hi', 'ar'].map((l) => ({
    take: `lang-${l}`, from: 0.15, crop, frames: ((window.TAKE_LOGS || {})[`lang-${l}`] || {}).frames30 || 9999,
    label: { en: 'ENGLISH', es: 'ESPAÑOL', hi: 'हिन्दी', ar: 'العربية' }[l] })) }
  t += LANG_SEG.len
  window.FILM = { SEGMENTS: list, LANG_SEG, FLY, OUT: 0.32, END_AT: t - 0.2, DURATION: t + 3.9 }
})()
